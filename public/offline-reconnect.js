const statusElement = document.querySelector("#connection-status");
const retryButton = document.querySelector("#retry-connection");
let checkingConnection = false;

async function tryReconnect() {
  if (checkingConnection) return;
  checkingConnection = true;
  retryButton.disabled = true;
  statusElement.textContent = "Checking connection…";

  try {
    const response = await fetch(`/api/health?offline-retry=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Health check failed");
    statusElement.textContent = "Connection restored. Reopening MaceSoft…";
    window.setTimeout(() => window.location.reload(), 300);
  } catch {
    statusElement.textContent = "Still offline. We’ll retry automatically.";
  } finally {
    checkingConnection = false;
    retryButton.disabled = false;
  }
}

retryButton.addEventListener("click", tryReconnect);
window.addEventListener("online", tryReconnect);
window.setInterval(tryReconnect, 5_000);
