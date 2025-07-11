// Password protection tool using PyScript + PyPDF (preferred) or pdf-lib-with-encrypt (fallback)
// Creates standard PDF encryption that works with any PDF viewer

let pyScriptLoaded = false;
let pyScriptLoading = false;

// Function to show/hide loading state for password protection
function showPasswordLoadingState(isLoading, errorMessage = null) {
  const passwordGroup = document.getElementById("passwordGroup");
  const pdfPassword = document.getElementById("pdfPassword");
  const confirmPassword = document.getElementById("confirmPassword");

  if (!passwordGroup) return;

  // Remove existing loading/error elements
  const existingLoading = passwordGroup.querySelector(".password-loading");
  const existingError = passwordGroup.querySelector(".password-error");
  if (existingLoading) existingLoading.remove();
  if (existingError) existingError.remove();

  if (isLoading) {
    // Show loading state
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "password-loading";
    loadingDiv.style.cssText = `
      margin: 10px 0;
      padding: 10px;
      border-radius: 4px;
      color: var(--primary-text);
      font-size: 14px;
    `;
    loadingDiv.innerHTML = `
      <span>loading password protection<span class="dots"></span></span>
      <style>
        .dots::after {
          content: '.';
          animation: dots 1.5s infinite;
        }
        @keyframes dots {
          0%, 33% { content: '.'; }
          34%, 66% { content: '..'; }
          67%, 100% { content: '...'; }
        }
      </style>
    `;
    passwordGroup.appendChild(loadingDiv);

    // Disable inputs during loading
    if (pdfPassword) pdfPassword.disabled = true;
    if (confirmPassword) confirmPassword.disabled = true;
  } else if (errorMessage) {
    // Show error state
    const errorDiv = document.createElement("div");
    errorDiv.className = "password-error";
    errorDiv.style.cssText = `
      margin: 10px 0;
      padding: 10px;
      background: #fff5f5;
      border: 1px solid #e53e3e;
      border-radius: 4px;
      color: #e53e3e;
      font-size: 14px;
    `;
    errorDiv.textContent = errorMessage;
    passwordGroup.appendChild(errorDiv);

    // Re-enable inputs
    if (pdfPassword) pdfPassword.disabled = false;
    if (confirmPassword) confirmPassword.disabled = false;
  } else {
    // Hide loading state, enable inputs
    if (pdfPassword) pdfPassword.disabled = false;
    if (confirmPassword) confirmPassword.disabled = false;
  }
}

// Function to load PyScript when user enables password protection
async function loadPyScript() {
  if (pyScriptLoaded) return;
  if (pyScriptLoading) {
    // If already loading, wait for it to complete
    while (pyScriptLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return;
  }

  pyScriptLoading = true;
  console.log("Loading PyScript worker for password protection...");

  try {
    // Load PyScript CSS
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://pyscript.net/releases/2025.7.2/core.css";
    document.head.appendChild(cssLink);

    // Load PyScript JS
    const scriptTag = document.createElement("script");
    scriptTag.type = "module";
    scriptTag.src = "https://pyscript.net/releases/2025.7.2/core.js";

    await new Promise((resolve, reject) => {
      scriptTag.onload = resolve;
      scriptTag.onerror = reject;
      document.head.appendChild(scriptTag);
    });

    // Wait for PyScript to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create worker script that handles pypdf (this runs in the worker)
    const workerScript = document.createElement("script");
    workerScript.type = "py";
    workerScript.setAttribute("worker", "");
    workerScript.setAttribute("name", "password-worker");
    workerScript.setAttribute("config", '{"packages":["pypdf"]}');
    workerScript.textContent = `
from pyscript import sync
from js import console, Uint8Array
import io

console.log("Worker: Starting pypdf import...")

try:
    from pypdf import PdfReader, PdfWriter
    console.log("Worker: pypdf imported successfully")

    def encrypt_pdf_with_password(pdf_bytes, password):
        try:
            console.log("Worker: Starting PDF encryption")
            pdf_data = bytes(pdf_bytes)
            console.log(f"Worker: PDF data length: {len(pdf_data)}")
            pdf_stream = io.BytesIO(pdf_data)
            reader = PdfReader(pdf_stream)
            console.log(f"Worker: PDF has {len(reader.pages)} pages")
            
            writer = PdfWriter()
            for page in reader.pages:
                writer.add_page(page)
            
            writer.encrypt(password)
            console.log("Worker: PDF encrypted successfully")
            
            output_stream = io.BytesIO()
            writer.write(output_stream)
            encrypted_bytes = output_stream.getvalue()
            console.log(f"Worker: Encrypted PDF length: {len(encrypted_bytes)}")
            
            return Uint8Array.new(encrypted_bytes)
            
        except Exception as e:
            console.error(f"Worker encryption error: {str(e)}")
            raise e

    # Export the function to be callable from main thread
    sync.encrypt_pdf_with_password = encrypt_pdf_with_password
    console.log("Worker: Encryption function exported and ready")
    
except Exception as e:
    console.error(f"Worker: Failed to setup encryption: {e}")
`;
    document.body.appendChild(workerScript);

    // Create main thread script to access the worker (lightweight)
    const mainScript = document.createElement("script");
    mainScript.type = "py";
    mainScript.textContent = `
from pyscript import workers
import js

async def setup_worker_access():
    try:
        js.console.log("Accessing password protection worker...")
        
        # Get reference to the named worker
        worker = await workers["password-worker"]
        
        # Store worker globally for access from JavaScript
        js.window.password_worker = worker
        js.window.pypdf_ready = True
        js.console.log("Password worker is ready for use")
        
    except Exception as e:
        js.console.error(f"Failed to access password worker: {e}")
        js.window.pypdf_ready = False

# Setup worker access
import asyncio
asyncio.create_task(setup_worker_access())
`;
    document.body.appendChild(mainScript);

    // Wait for the worker to be ready
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds (package installation takes time)
    while (window.pypdf_ready === undefined && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    if (window.pypdf_ready !== true) {
      throw new Error("PyScript worker failed to load properly");
    }

    pyScriptLoaded = true;
    console.log("PyScript worker loaded successfully for password protection");
  } catch (error) {
    console.error("Failed to load PyScript worker:", error);
    throw error;
  } finally {
    pyScriptLoading = false;
  }
}

export async function applyPasswordProtection(pdfBytes) {
  const enablePassword = document.getElementById("enablePassword").checked;

  if (!enablePassword) return pdfBytes;

  const passwordInput = document.getElementById("pdfPassword").value;
  const confirmPasswordInput = document.getElementById("confirmPassword").value;

  if (!passwordInput) {
    throw new Error("Password is required");
  }

  if (passwordInput !== confirmPasswordInput) {
    throw new Error("Passwords do not match");
  }

  // Load PyScript if not already loaded
  if (!pyScriptLoaded) {
    try {
      await loadPyScript();
    } catch (error) {
      console.error("Failed to load PyScript:", error);
      throw new Error(
        "Failed to load password protection library: " + error.message
      );
    }
  }

  // Use PyScript worker for encryption
  if (window.password_worker && window.pypdf_ready) {
    try {
      console.log("Using PyScript worker for PDF encryption");

      // Convert to Uint8Array if needed
      const uint8Array =
        pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

      // Call the worker function (sync exports are called directly on worker)
      const encryptedBytes =
        await window.password_worker.encrypt_pdf_with_password(
          uint8Array,
          passwordInput
        );

      console.log("Worker encryption successful");
      return encryptedBytes;
    } catch (error) {
      console.error("Worker encryption failed:", error);
      throw new Error("Failed to encrypt PDF: " + error.message);
    }
  }

  throw new Error("Password protection worker not available");
}

export function isPasswordEnabled() {
  return document.getElementById("enablePassword").checked;
}

// Show/hide password fields and load PyScript when needed
document.addEventListener("DOMContentLoaded", function () {
  const enablePassword = document.getElementById("enablePassword");
  const passwordGroup = document.getElementById("passwordGroup");

  if (enablePassword && passwordGroup) {
    enablePassword.addEventListener("change", function () {
      passwordGroup.style.display = this.checked ? "block" : "none";

      // Load PyScript in background when user enables password protection
      if (this.checked && !pyScriptLoaded && !pyScriptLoading) {
        console.log(
          "User enabled password protection, loading PyScript in background..."
        );

        // Show loading state
        showPasswordLoadingState(true);

        loadPyScript()
          .then(() => {
            showPasswordLoadingState(false);
          })
          .catch((error) => {
            console.error("Failed to preload PyScript:", error);
            showPasswordLoadingState(
              false,
              "Failed to load password protection"
            );
          });
      }
    });
  }
});
