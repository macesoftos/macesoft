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
  const recipientEmail = `audience-preview-${Date.now()}@example.test`;
  const recipientCreateStatus = await page.evaluate(async (email) => {
    const response = await fetch("/api/clients", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Mace-Request": "app" },
      body: JSON.stringify({
        id: `audience-preview-${Date.now()}`,
        fullName: "Audience Preview Recipient",
        email,
        mobile: "0917 555 0142",
        branch: "Mace Davao",
        marketingOptIn: true,
        retention: "Inactive",
        lastVisit: "2025-01-15",
        source: "Release test",
      }),
    });
    return response.status;
  }, recipientEmail);
  expect(recipientCreateStatus).toBe(201);
  const recipientBootstrap = page.waitForResponse((response) => response.url().endsWith("/api/bootstrap") && response.request().method() === "GET");
  await page.reload();
  expect((await recipientBootstrap).status()).toBe(200);

  if (!hasRealObjectStorage) {
    let uploadedDataUrl = "";
    await page.route("**/api/marketing/media", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        json: {
          assets: [{
            id: "canvas-drop-ci-asset",
            name: "canvas-drop-e2e.png",
            originalName: "canvas-drop-e2e.png",
            url: "/api/uploads/canvas-drop-ci-asset",
            mimeType: "image/png",
            byteSize: 1024,
            branch: "Mace Davao",
            createdAt: new Date().toISOString(),
          }],
        },
        status: 200,
      });
    });
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

  await page.goto("/marketing/campaigns/new");
  await expect(page.getByTestId("marketing-workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Summer Skin Reset/i })).toBeVisible();
  await page.getByLabel("Campaign branch").selectOption({ label: "Mace Davao" });

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
    const publicAsset = await page.evaluate(async (assetId) => {
      const response = await fetch(`/api/public/marketing-assets/${encodeURIComponent(assetId)}`, { credentials: "omit" });
      return {
        byteLength: (await response.arrayBuffer()).byteLength,
        cacheControl: response.headers.get("cache-control"),
        crossOriginResourcePolicy: response.headers.get("cross-origin-resource-policy"),
        status: response.status,
      };
    }, canvasAssetId);
    expect(publicAsset.status).toBe(200);
    expect(publicAsset.byteLength).toBeGreaterThan(0);
    expect(publicAsset.cacheControl).toContain("public");
    expect(publicAsset.crossOriginResourcePolicy).toBe("cross-origin");
  }
  await imageSettings.getByRole("button", { name: "Replace", exact: true }).click();
  await imageSettings.getByRole("button", { name: "Browse Library" }).click();
  const mediaDialog = page.getByRole("dialog", { name: "Content studio" });
  await expect(mediaDialog.getByRole("heading", { name: "Content studio", exact: true })).toBeVisible();
  await expect(mediaDialog.getByRole("button", { name: /canvas-drop-e2e\.png/i }).first()).toBeVisible({ timeout: 15_000 });
  await expect(mediaDialog.getByRole("button", { name: "Insert image", exact: true })).toBeEnabled();
  const mediaStacking = await page.evaluate(() => {
    const dialog = document.querySelector(".marketing-media-dialog");
    const stepper = document.querySelector(".marketing-stepper");
    const insertButton = dialog?.querySelector(".marketing-primary-button");
    return {
      dialogInWorkspace: dialog?.parentElement?.classList.contains("marketing-workspace"),
      dialogZIndex: Number.parseInt(getComputedStyle(dialog).zIndex, 10) || 0,
      insertButtonBackground: insertButton ? getComputedStyle(insertButton).backgroundColor : "",
      stepperZIndex: Number.parseInt(getComputedStyle(stepper).zIndex, 10) || 0,
    };
  });
  expect(mediaStacking.dialogInWorkspace).toBe(true);
  expect(mediaStacking.dialogZIndex).toBeGreaterThan(mediaStacking.stepperZIndex);
  expect(mediaStacking.insertButtonBackground).not.toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({ path: `${artifactDirectory}/content-studio-media-library.png`, fullPage: false });
  await mediaDialog.getByRole("button", { name: "Cancel", exact: true }).click();
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

  await page.getByRole("button", { name: "Drag or click to add Social", exact: true }).click();
  const socialBlock = page.locator(".marketing-email-block.type-social.selected");
  await expect(socialBlock.getByRole("link", { name: "Follow MACE on Instagram" }).locator("svg")).toHaveCount(1);
  await expect(socialBlock.getByRole("link", { name: "Visit the MACE website" }).locator("svg")).toHaveCount(1);
  await expect(socialBlock.getByText(/^[IW]$/)).toHaveCount(0);

  const visualBlocksBeforeHtml = await page.locator(".marketing-email-block").count();
  await page.getByRole("tab", { name: "HTML", exact: true }).click();
  const htmlSource = page.getByLabel("Email HTML source");
  await expect(htmlSource).toHaveValue(/E2E Brightening Treatment/);
  const generatedSource = await htmlSource.inputValue();
  await htmlSource.fill(`${generatedSource}\n<!-- release-test-custom-html -->`);
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await expect(page.getByText("E2E Brightening Treatment", { exact: true })).toBeVisible();
  await expect(page.locator(".marketing-email-block")).toHaveCount(visualBlocksBeforeHtml);
  await page.getByRole("tab", { name: "HTML", exact: true }).click();
  await expect(htmlSource).toHaveValue(/release-test-custom-html/);
  await page.getByRole("tab", { name: "Design", exact: true }).click();

  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page.getByRole("tab", { name: "Manage", exact: true }).click();
  const managedSections = page.locator(".marketing-manage-section-row");
  await expect(managedSections).toHaveCount(visualBlocksBeforeHtml);
  const firstManagedId = await managedSections.nth(0).getAttribute("data-block-id");
  const secondManagedId = await managedSections.nth(1).getAttribute("data-block-id");
  await managedSections.nth(0).dragTo(managedSections.nth(1), { targetPosition: { x: 12, y: 48 } });
  await expect(managedSections.nth(0)).toHaveAttribute("data-block-id", secondManagedId);
  await expect(managedSections.nth(1)).toHaveAttribute("data-block-id", firstManagedId);
  await managedSections.nth(1).locator(".marketing-manage-section-actions button").first().click();
  await expect(managedSections.nth(0)).toHaveAttribute("data-block-id", firstManagedId);

  // Let the debounce-triggered autosave finish before exercising the explicit
  // Save button. Otherwise both identical writes queue against a remote test
  // database and the assertion can observe the first response while the UI is
  // still waiting for the second.
  const saveState = page.locator(".marketing-builder-actions > span");
  await expect(saveState).toContainText("Saved to campaign", { timeout: 60_000 });
  const campaignSave = page.waitForResponse((response) => response.url().includes("/api/resources/campaigns") && ["POST", "PUT"].includes(response.request().method()));
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await campaignSave).status()).toBeLessThan(300);
  await expect(saveState).toContainText("Saved to campaign", { timeout: 60_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export HTML/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("summer-skin-reset.html");

  await page.getByRole("button", { name: /Preview email/i }).click();
  const previewDialog = page.getByRole("dialog", { name: /Preview Summer Skin Reset/i });
  await expect(previewDialog).toBeVisible();
  const previewFrame = previewDialog.locator("iframe").contentFrame();
  await expect(previewFrame.getByText("E2E Brightening Treatment", { exact: true })).toBeVisible();
  const previewSocialIcons = previewFrame.locator('img[src*="/brand/social/"]');
  await expect(previewSocialIcons).toHaveCount(2);
  await expect.poll(() => previewSocialIcons.first().evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  if (hasRealObjectStorage) {
    const previewUpload = previewFrame.locator(`img[src*="/api/public/marketing-assets/${canvasAssetId}"]`);
    await expect(previewUpload).toHaveCount(1);
    await expect.poll(() => previewUpload.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  }
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

  const builderHeader = page.locator(".marketing-builder-header");
  await builderHeader.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Approved by your admin account", { exact: true })).toBeVisible();
  await builderHeader.getByRole("button", { name: "Continue", exact: true }).click();
  const deliveryTime = await page.evaluate(() => {
    const date = new Date(Date.now() + (10 * 60 * 1000));
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  });
  await page.getByLabel("Send date and time").fill(deliveryTime);
  await expect(page.getByText("Approved by your admin account", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /View recipients/i }).click();
  const audienceDialog = page.getByRole("dialog", { name: "Audience recipients" });
  await expect(audienceDialog).toBeVisible();
  await expect(audienceDialog.getByText(recipientEmail, { exact: true })).toBeVisible();
  await audienceDialog.getByLabel("Search audience recipients").fill(recipientEmail);
  await expect(audienceDialog.getByRole("row")).toHaveCount(2);
  await page.screenshot({ path: `${artifactDirectory}/audience-recipient-preview.png`, fullPage: false });
  await audienceDialog.getByRole("button", { name: "Close audience recipients" }).last().click();
  await expect(audienceDialog).toBeHidden();
  const scheduleResponse = page.waitForResponse((response) => response.url().endsWith("/schedule") && response.request().method() === "POST");
  await builderHeader.getByRole("button", { name: "Confirm schedule", exact: true }).click();
  const schedule = await scheduleResponse;
  expect(schedule.status()).toBe(200);
  const scheduleBody = await schedule.json();
  expect(scheduleBody.approvalRequired).toBe(false);
  expect(scheduleBody.campaign.managerApproval).toBe(false);
  expect(scheduleBody.campaign.status).toBe("Scheduled");
  expect(scheduleBody.campaign.deliveryStatus).toBe("Queued");
  await expect(page.getByText("Campaign scheduled and added to the delivery queue.", { exact: true })).toBeVisible();

  const campaignListBootstrap = page.waitForResponse((response) => response.url().endsWith("/api/bootstrap") && response.request().method() === "GET");
  await page.goto("/marketing/campaigns");
  expect((await campaignListBootstrap).status()).toBe(200);
  const campaignRow = page.getByRole("row").filter({ hasText: "Summer Skin Reset" });
  await expect(campaignRow).toBeVisible();
  await expect(campaignRow.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(campaignRow.getByRole("button", { name: "Queued", exact: true })).toBeDisabled();
  await campaignRow.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByText("E2E Brightening Treatment", { exact: true })).toBeVisible();

  await page.goto("/marketing/templates");
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
    const permanentCleanup = await page.request.delete("/api/marketing/media/permanent", {
      data: { ids: [canvasAssetId] },
      headers: { "X-Mace-Request": "app" },
    });
    expect(permanentCleanup.status()).toBe(200);
    expect((await permanentCleanup.json()).count).toBe(1);
  }
}
