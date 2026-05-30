const SUPABASE_URL = "https://kxkkoadoybxhdoxqmeqj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4a2tvYWRveWJ4aGRveHFtZXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDczMjcsImV4cCI6MjA5NTcyMzMyN30.PbXYYeNfsQGIYgGWcemD7QZryxs_xhlkWsAVG-PnC2A";

const BUCKET_NAME = "pdf-files";
const TABLE_NAME = "pdf_documents";

const LOGIN_USER = "Awad";
const LOGIN_PASS = "12345";

let supabaseClient = null;
let allFiles = [];

document.addEventListener("DOMContentLoaded", function () {
  initializeSupabase();

  showLogin();
});

function initializeSupabase() {
  const urlReady =
    SUPABASE_URL &&
    SUPABASE_URL !== "ضع رابط Supabase هنا" &&
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_URL.endsWith(".supabase.co");

  const keyReady =
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY !== "ضع مفتاح anon public هنا";

  if (urlReady && keyReady && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    supabaseClient = null;
  }
}

function showLogin() {
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("appPage").classList.add("hidden");
}

function showApp() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");

  if (!supabaseClient) {
    document.getElementById("filesList").innerHTML =
      "<p class='error'>تنبيه: تأكد أن رابط Supabase ينتهي بـ .supabase.co بدون /rest/v1/، وأن مفتاح anon public موجود.</p>";
    return;
  }

  loadFiles();
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorElement = document.getElementById("loginError");

  if (username === LOGIN_USER && password === LOGIN_PASS) {
    errorElement.textContent = "";
    showApp();
    return;
  }

  errorElement.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة";
}

function logout() {
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  showLogin();
}

function formatDate(dateValue) {
  try {
    return new Intl.DateTimeFormat("ar", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(dateValue));
  } catch (error) {
    return dateValue;
  }
}

function formatSize(bytes) {
  const size = Number(bytes || 0);

  if (size < 1024) {
    return size + " بايت";
  }

  if (size < 1024 * 1024) {
    return Math.round(size / 1024) + " كيلوبايت";
  }

  return (size / (1024 * 1024)).toFixed(2) + " ميجابايت";
}

async function loadFiles() {
  if (!supabaseClient) {
    return;
  }

  const filesList = document.getElementById("filesList");
  filesList.innerHTML = "<p class='small'>جاري تحميل الملفات...</p>";

  const result = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  if (result.error) {
    filesList.innerHTML =
      "<p class='error'>حدث خطأ أثناء تحميل الملفات: " +
      result.error.message +
      "</p>";
    return;
  }

  allFiles = result.data || [];
  renderFiles();
}

function renderFiles() {
  const filesList = document.getElementById("filesList");
  const searchInput = document.getElementById("searchInput");
  const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filteredFiles = allFiles.filter(function (file) {
    return file.name.toLowerCase().includes(searchValue);
  });

  document.getElementById("filesCount").textContent = allFiles.length;

  const totalVisits = allFiles.reduce(function (sum, file) {
    return sum + Number(file.visits || 0);
  }, 0);

  document.getElementById("visitsCount").textContent = totalVisits;

  if (filteredFiles.length === 0) {
    filesList.innerHTML = "<p class='small'>لا توجد ملفات محفوظة حاليًا.</p>";
    return;
  }

  filesList.innerHTML = "";

  filteredFiles.forEach(function (file) {
    const item = document.createElement("div");
    item.className = "file-item";

    item.innerHTML = `
      <h3>${escapeHtml(file.name)}</h3>

      <div class="file-meta">
        تاريخ الرفع: ${formatDate(file.created_at)}
        <br>
        حجم الملف: ${formatSize(file.size_bytes)}
        <br>
        عدد الزيارات: <strong>${file.visits || 0}</strong>
      </div>

      <div class="file-actions">
        <button class="secondary" onclick="viewFile('${file.id}')">عرض الملف</button>
        <button onclick="downloadOriginal('${file.id}')">تحميل الملف</button>
        <button class="danger" onclick="deleteFile('${file.id}')">حذف</button>
      </div>
    `;

    filesList.appendChild(item);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getFileById(fileId) {
  return allFiles.find(function (file) {
    return file.id === fileId;
  });
}

async function uploadPdf() {
  if (!supabaseClient) {
    alert("لم يتم إعداد Supabase داخل ملف script.js.");
    return;
  }

  const input = document.getElementById("pdfInput");
  const status = document.getElementById("uploadStatus");
  const file = input.files[0];

  if (!file) {
    status.textContent = "اختر ملف PDF أولًا.";
    return;
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    status.textContent = "الملف يجب أن يكون PDF.";
    return;
  }

  status.textContent = "جاري إنشاء رابط العرض وإدراج QR...";

  try {
    const fileId = createUuid();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = fileId + "-QR-" + safeName;

    const publicUrlResult = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const finalPublicUrl = publicUrlResult.data.publicUrl;
    const viewerUrl = getViewerUrl(fileId);

    const qrPdfBlob = await createPdfWithAutoQr(file, viewerUrl);

    status.textContent = "جاري رفع الملف بعد إدراج QR...";

    const uploadResult = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, qrPdfBlob, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadResult.error) {
      status.textContent = "فشل رفع الملف: " + uploadResult.error.message;
      return;
    }

    const insertResult = await supabaseClient
      .from(TABLE_NAME)
      .insert({
        id: fileId,
        name: file.name,
        storage_path: filePath,
        public_url: finalPublicUrl,
        size_bytes: qrPdfBlob.size,
        visits: 0
      });

    if (insertResult.error) {
      status.textContent =
        "تم رفع الملف لكن فشل حفظ بياناته: " + insertResult.error.message;
      return;
    }

    input.value = "";
    status.textContent = "تم رفع الملف مع إدراج QR وحفظه بنجاح.";

    await loadFiles();
  } catch (error) {
    status.textContent = "حدث خطأ أثناء تجهيز QR: " + error.message;
  }
}

function createUuid() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
    const random = Math.random() * 16 | 0;
    const value = char === "x" ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function getViewerUrl(fileId) {
  const currentPath = window.location.pathname;
  const basePath = currentPath.substring(0, currentPath.lastIndexOf("/") + 1);

  return window.location.origin + basePath + "viewer.html?id=" + fileId;
}

async function createPdfWithAutoQr(file, qrContent) {
  const qrPage = Number(document.getElementById("qrPage").value || 1);
  const qrX = Number(document.getElementById("qrX").value || 410);
  const qrY = Number(document.getElementById("qrY").value || 70);
  const qrSize = Number(document.getElementById("qrSize").value || 95);

  const arrayBuffer = await file.arrayBuffer();

  const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  const pageIndex = Math.min(Math.max(qrPage - 1, 0), pages.length - 1);
  const page = pages[pageIndex];

  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    margin: 1,
    width: qrSize
  });

  const qrImageBytes = dataUrlToUint8Array(qrDataUrl);
  const qrImage = await pdfDoc.embedPng(qrImageBytes);

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize
  });

  const newPdfBytes = await pdfDoc.save();

  return new Blob([newPdfBytes], {
    type: "application/pdf"
  });
}

function viewFile(fileId) {
  window.open(getViewerUrl(fileId), "_blank");
}

function downloadOriginal(fileId) {
  const file = getFileById(fileId);

  if (!file) {
    alert("لم يتم العثور على الملف.");
    return;
  }

  const link = document.createElement("a");
  link.href = file.public_url;
  link.download = file.name;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function deleteFile(fileId) {
  const file = getFileById(fileId);

  if (!file) {
    alert("لم يتم العثور على الملف.");
    return;
  }

  const confirmDelete = confirm("هل تريد حذف الملف: " + file.name + "؟");

  if (!confirmDelete) {
    return;
  }

  const storageResult = await supabaseClient.storage
    .from(BUCKET_NAME)
    .remove([file.storage_path]);

  if (storageResult.error) {
    alert("تعذر حذف الملف من التخزين: " + storageResult.error.message);
    return;
  }

  const dbResult = await supabaseClient
    .from(TABLE_NAME)
    .delete()
    .eq("id", file.id);

  if (dbResult.error) {
    alert("تم حذف الملف من التخزين لكن تعذر حذف السجل: " + dbResult.error.message);
    return;
  }

  allFiles = allFiles.filter(function (item) {
    return item.id !== file.id;
  });

  renderFiles();
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
    }
