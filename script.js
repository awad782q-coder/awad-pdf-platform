const SUPABASE_URL = "https://kxkkoadoybxhdoxqmeqj.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4a2tvYWRveWJ4aGRveHFtZXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDczMjcsImV4cCI6MjA5NTcyMzMyN30.PbXYYeNfsQGIYgGWcemD7QZryxs_xhlkWsAVG-PnC2A";

const BUCKET_NAME = "pdf-files";
const TABLE_NAME = "pdf_documents";

const LOGIN_USER = "Awad";
const LOGIN_PASS = "12345";
const SESSION_KEY = "awad_pdf_logged_in";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allFiles = [];

document.addEventListener("DOMContentLoaded", function () {
  const isLoggedIn = localStorage.getItem(SESSION_KEY) === "yes";

  if (isLoggedIn) {
    showApp();
  } else {
    showLogin();
  }
});

function showLogin() {
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("appPage").classList.add("hidden");
}

function showApp() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");
  loadFiles();
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorElement = document.getElementById("loginError");

  if (username === LOGIN_USER && password === LOGIN_PASS) {
    localStorage.setItem(SESSION_KEY, "yes");
    errorElement.textContent = "";
    showApp();
    return;
  }

  errorElement.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة";
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
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
  const filesList = document.getElementById("filesList");
  filesList.innerHTML = "جاري تحميل الملفات...";

  const result = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  if (result.error) {
    filesList.innerHTML = "حدث خطأ أثناء تحميل الملفات: " + result.error.message;
    return;
  }

  allFiles = result.data || [];
  renderFiles();
}

function renderFiles() {
  const filesList = document.getElementById("filesList");
  const searchValue = document.getElementById("searchInput").value.trim().toLowerCase();

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
        <button class="green" onclick="downloadWithQr('${file.id}')">تحميل + QR</button>
        <button class="secondary" onclick="viewFile('${file.id}')">عرض الملف</button>
        <button onclick="downloadOriginal('${file.id}')">تحميل الأصل</button>
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

  status.textContent = "جاري رفع الملف...";

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const filePath = Date.now() + "-" + crypto.randomUUID() + "-" + safeName;

  const uploadResult = await supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false
    });

  if (uploadResult.error) {
    status.textContent = "فشل رفع الملف: " + uploadResult.error.message;
    return;
  }

  const publicUrlResult = supabaseClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlResult.data.publicUrl;

  const insertResult = await supabaseClient
    .from(TABLE_NAME)
    .insert({
      name: file.name,
      storage_path: filePath,
      public_url: publicUrl,
      size_bytes: file.size,
      visits: 0
    });

  if (insertResult.error) {
    status.textContent = "تم رفع الملف لكن فشل حفظ بياناته: " + insertResult.error.message;
    return;
  }

  input.value = "";
  status.textContent = "تم رفع الملف وحفظه بنجاح.";

  await loadFiles();
}

async function viewFile(fileId) {
  const file = getFileById(fileId);

  if (!file) {
    alert("لم يتم العثور على الملف.");
    return;
  }

  const currentVisits = Number(file.visits || 0);
  const nextVisits = currentVisits + 1;

  document.getElementById("viewerTitle").textContent = file.name;
  document.getElementById("pdfViewer").src = file.public_url;

  file.visits = nextVisits;
  renderFiles();

  const updateResult = await supabaseClient
    .from(TABLE_NAME)
    .update({ visits: nextVisits })
    .eq("id", file.id);

  if (updateResult.error) {
    alert("تعذر تحديث عدد الزيارات: " + updateResult.error.message);
  }
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

  const viewer = document.getElementById("pdfViewer");
  if (viewer.src === file.public_url) {
    viewer.src = "";
    document.getElementById("viewerTitle").textContent = "صفحة العرض";
  }

  renderFiles();
}

async function downloadWithQr(fileId) {
  const file = getFileById(fileId);

  if (!file) {
    alert("لم يتم العثور على الملف.");
    return;
  }

  try {
    const qrPage = Number(document.getElementById("qrPage").value || 1);
    const qrX = Number(document.getElementById("qrX").value || 420);
    const qrY = Number(document.getElementById("qrY").value || 80);
    const qrSize = Number(document.getElementById("qrSize").value || 95);

    const response = await fetch(file.public_url);
    const arrayBuffer = await response.arrayBuffer();

    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();

    const pageIndex = Math.min(Math.max(qrPage - 1, 0), pages.length - 1);
    const page = pages[pageIndex];

    const qrContent = file.public_url;

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

    const blob = new Blob([newPdfBytes], {
      type: "application/pdf"
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "QR-" + file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  } catch (error) {
    alert("تعذر إنشاء نسخة QR: " + error.message);
  }
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
