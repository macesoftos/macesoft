import { mkdir } from "node:fs/promises";

const artifactDirectory = "test-results/marketing-builder";
const hasRealObjectStorage = Boolean(process.env.STORAGE_BASE_URL && process.env.STORAGE_BUCKET && process.env.STORAGE_SERVICE_KEY);

async function imageFileTransfer(page, name = "canvas-drop-e2e.png") {
  return page.evaluateHandle(async (fileName) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 500;
    const context = canvas.getContext("2d");
    context.fillStyle = "#c16c82";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], fileName, { type: "image/png" }));
    return transfer;
  }, name);
}

export async function verifyMarketingBuilder(page, expect) {
  await mkdir(artifactDirectory, { recursive: true });

  if (!hasRealObjectStorage) {
    let uploadedDataUrl = "";
    await page.route("**/api/uploads/canvas-drop-ci-asset", async (route) => {
      const encoded = uploadedDataUrl.split(",")[1] || "";
      await route.fulfill({ body: Buffer.from(encoded, "base64"), contentType: "image/png", status: 200 });
    });
    await page.route("**/api/uploads", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }
      const payload = request.postDataJSON();
      expect(payload.category).toBe("marketing-image");
      expect(payload.originalName).toBe("canvas-drop-e2e.png");
      expect(payload.dataUrl).toMatch(/^data:image\/png;base64,/);
      uploadedDataUrl = payload.dataUrl;
      await route.fulfill({
        contentType: "application/json",
        json: { asset: { id: "canvas-drop-ci-asset", name: payload.originalName, originalName: payload.originalName, url: "/api/uploads/canvas-drop-ci-asset" } },
        status: 201,
      });
    });
  }

  await page.goto("/#/marketing/campaigns/new");
  await expect(page.getByTestId("marketing-workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Summer Skin Reset/i })).toBeVisible();

  const canvasImage = page.locator(".marketing-email-block.type-image").first();
  const imageTransfer = await imageFileTransfer(page);
  await canvasImage.dispatchEvent("dragenter", { dataTransfer: imageTransfer });
  await expect(canvasImage.getByText("Drop image to replace", { exact: true })).toBeVisible();
  const canvasUpload = page.waitForResponse((response) => response.url().endsWith("/api/uploads") && response.request().method() === "POST");
  await canvasImage.dispatchEvent("drop", { dataTransfer: imageTransfer });
  const canvasUploadResponse = await canvasUpload;
  expect(canvasUploadResponse.status()).toBe(201);
  const canvasUploadBody = await canvasUploadResponse.json();
  const canvasAssetId = canvasUploadBody.asset?.id;
  expect(canvasAssetId).toBeTruthy();
  const uploadedImage = canvasImage.locator("img");
  await expect(uploadedImage).toHaveAttribute("src", new RegExp(`/api/uploads/${canvasAssetId}$`));
  await expect.poll(() => uploadedImage.evaluate((image) => image.naturalWidth)).toBe(1200);
  const renderedSize = await uploadedImage.evaluate((image) => ({ height: image.getBoundingClientRect().height, width: image.getBoundingClientRect().width }));
  expect(renderedSize.width).toBeLessThanOrEqual(600);
  expect(Math.abs((renderedSize.width / renderedSize.height) - (1200 / 500))).toBeLessThan(0.03);
  await expect(canvasImage.getByText("Uploading image…", { exact: true })).toBeHidden();
  const imageSettings = page.locator(".marketing-block-settings");
  await imageSettings.getByRole("tab", { name: "Style", exact: true }).click();
  await expect(imageSettings.getByText("Natural image size", { exact: true })).toBeVisible();
  await expect(imageSettings.getByText("Height follows the uploaded image automatically.", { exact: false })).toBeVisible();
  await expect(imageSettings.locator("label").filter({ hasText: "Aspect ratio" })).toHaveCount(0);
  await imageSettings.getByRole("tab", { name: "Content", exact: true }).click();
  if (hasRealObjectStorage) {
    const mediaResponse = await page.request.get("/api/marketing/media");
    expect(mediaResponse.status()).toBe(200);
    const mediaBody = await mediaResponse.json();
    expect(mediaBody.assets.some((asset) => asset.id === canvasAssetId && asset.name === "canvas-drop-e2e.png")).toBe(true);
  }
  await page.screenshot({ path: `${artifactDirectory}/canvas-image-drop-uploaded.png`, fullPage: false });

  await page.getByRole("button", { name: "Drag or click to add Product", exact: true }).click();
  const settings = page.locator(".marketing-block-settings");
  const settingControl = (label, selector = "input, textarea, select") => settings.locator("label").filter({ hasText: label }).locator(selector).first();
  await expect(settings.filter({ hasText: "Product" })).toBeVisible();
  await settings.getByText("Use an image URL", { exact: true }).click();
  await settingControl("Image URL", "input").fill("/brand/result-2.jpg");
  await settingControl("Alternative text", "input").fill("Client after a MACE brightening treatment");
  await settingControl("Category or eyebrow").fill("MACE TREATMENT");
  await settingControl("Product title").fill("E2E Brightening Treatment");
  await settingControl("Product description").fill("A complete independent Product description saved by the release workflow.");
  await settingControl("Primary CTA label", "input").fill("Explore treatment");
  await settingControl("Primary CTA destination", "input").fill("https://macebydrmace.com/treatments?source=e2e");

  await page.getByRole("tab", { name: "Style", exact: true }).click();
  await settingControl("Aspect ratio", "select").selectOption("4:3");
  await settingControl("Zoom", "input[type=number]").fill("125");
  await settingControl("Focal point X", "input[type=number]").fill("42");
  await settingControl("Focal point Y", "input[type=number]").fill("35");
  await settingControl("Image position", "select").selectOption("left");
  await settingControl("CTA style", "select").selectOption("button");

  await page.locator(".marketing-email-block.type-product.selected").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Hide Marketing menu" }).click();
  await expect(page.getByRole("button", { name: "Show Marketing menu" })).toBeVisible();
  await page.screenshot({ path: `${artifactDirectory}/product-editor-desktop.png`, fullPage: false });

  const campaignSave = page.waitForResponse((response) => response.url().includes("/api/resources/campaigns") && ["POST", "PUT"].includes(response.request().method()));
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await campaignSave).status()).toBeLessThan(300);
  await expect(page.getByText(/Saved to campaign/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export HTML/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("summer-skin-reset.html");

  await page.getByRole("button", { name: /Preview email/i }).click();
  const previewDialog = page.getByRole("dialog", { name: /Preview Summer Skin Reset/i });
  await expect(previewDialog).toBeVisible();
  const previewFrame = previewDialog.locator("iframe").contentFrame();
  await expect(previewFrame.getByText("E2E Brightening Treatment", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${artifactDirectory}/email-preview-desktop.png`, fullPage: false });
  await previewDialog.getByRole("button", { name: "Mobile", exact: true }).click();
  await page.screenshot({ path: `${artifactDirectory}/email-preview-mobile.png`, fullPage: false });
  await previewDialog.getByRole("button", { name: "Close email preview" }).last().click();

  await page.getByRole("button", { name: "Send test", exact: true }).click();
  const testDialog = page.getByRole("dialog", { name: "Send test email" });
  await testDialog.getByLabel("Email addresses").fill("qa@example.com");
  const sendTest = page.waitForResponse((response) => response.url().endsWith("/api/marketing/send-test") && response.request().method() === "POST");
  await testDialog.getByRole("button", { name: "Send test", exact: true }).click();
  expect((await sendTest).status()).toBe(200);
  await expect(testDialog.getByText("The email passed the server delivery simulation.", { exact: true })).toBeVisible();
  await testDialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: /Save as template/i }).click();
  const templateDialog = page.getByRole("dialog", { name: "Save email template" });
  await templateDialog.getByLabel("Template name").fill("Release-tested Product email");
  await templateDialog.getByLabel("Description").fill("Verified Product fields, responsive preview, and server persistence.");
  const templateSave = page.waitForResponse((response) => response.url().endsWith("/api/marketing/templates") && response.request().method() === "POST");
  await templateDialog.getByRole("button", { name: "Save template", exact: true }).click();
  expect((await templateSave).status()).toBe(201);
  await expect(templateDialog).toBeHidden();

  await page.goto("/#/marketing/campaigns");
  const campaignRow = page.getByRole("row").filter({ hasText: "Summer Skin Reset" });
  await expect(campaignRow).toBeVisible();
  await campaignRow.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByText("E2E Brightening Treatment", { exact: true })).toBeVisible();

  await page.goto("/#/marketing/templates");
  const savedTemplateHeading = page.getByRole("heading", { name: "Release-tested Product email", exact: true });
  await expect(savedTemplateHeading).toBeVisible();
  await savedTemplateHeading.locator("xpath=ancestor::article").getByRole("button", { name: "Preview", exact: true }).click();
  const savedTemplatePreview = page.getByRole("dialog", { name: "Preview Release-tested Product email" });
  await expect(savedTemplatePreview).toBeVisible();
  await savedTemplatePreview.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Show Marketing menu" }).click();
  await page.getByRole("button", { name: "Return to MACE applications" }).click();
  await page.getByRole("button", { name: "My Workspace", exact: true }).click();
  await expect(page.getByLabel(/open account menu for/i)).toBeVisible();

  if (hasRealObjectStorage) {
    const cleanupResponse = await page.request.delete(`/api/uploads/${canvasAssetId}`, { headers: { "X-Mace-Request": "app" } });
    expect(cleanupResponse.status()).toBe(204);
  }
}
