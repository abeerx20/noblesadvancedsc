import { api } from "./api.js";
import { configurationReady, firebaseAuth, loginWithEmail, loginWithNationalId } from "./firebase-client.js";
import { clearNotice, setNotice, submitSafely } from "./ui.js";

const form = document.querySelector("#loginForm");
const button = document.querySelector("#loginButton");
const notice = document.querySelector("#authNotice");
const tabs = document.querySelectorAll(".auth-tab");
const identifierInput = document.querySelector("#identifier");
const passwordInput = document.querySelector("#password");
const passwordField = document.querySelector("#passwordField");
const rememberMeInput = document.querySelector("#rememberMe");
const togglePasswordButton = document.querySelector("#togglePassword");
const identifierLabel = document.querySelector('label[for="identifier"]');
const demoHint = document.querySelector("#demoHint");
const STORAGE_KEY = "nas-login-remembered";
const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const demoParentId = "1234567890";
const demoParentPassword = "Parent@123";
let selectedAccountType = "employee";
let navigationLocked = false;

if (location.pathname.endsWith("login.html")) {
  sessionStorage.removeItem("nas-login-redirecting");
}

function safeNavigate(target) {
  const targetPath = target.split("?")[0];
  const currentPath = location.pathname.split("/").pop() || "index.html";
  if (currentPath === targetPath) return;
  window.location.replace(target);
}

function navigateToDashboardOnce() {
  if (navigationLocked) return;
  navigationLocked = true;
  sessionStorage.setItem("nas-login-redirecting", "1");
  safeNavigate("mynas.html");
}

function setSelectedTab(nextType) {
  const previousAccountType = selectedAccountType;
  selectedAccountType = nextType;
  tabs.forEach((tab) => {
    const isActive = tab.dataset.accountType === nextType;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  const isParent = nextType === "parent";
  const rememberMeLabel = rememberMeInput.closest(".remember-me");
  if (isParent) {
    identifierLabel.textContent = demoMode ? "رقم الهوية التجريبي" : "رقم الهوية";
    identifierInput.value = "";
    identifierInput.type = "text";
    identifierInput.inputMode = "numeric";
    identifierInput.pattern = "[0-9]{10}";
    identifierInput.maxLength = 10;
    identifierInput.placeholder = "أدخلي رقم الهوية";
    passwordField.hidden = false;
    passwordInput.required = true;
    passwordInput.value = "";
    passwordInput.placeholder = demoMode ? "كلمة المرور التجريبية" : "";
    rememberMeInput.checked = false;
    rememberMeLabel.hidden = true;
    localStorage.removeItem(STORAGE_KEY);
  } else {
    identifierLabel.textContent = "البريد الإلكتروني";
    if (previousAccountType === "parent") identifierInput.value = "";
    identifierInput.type = "text";
    identifierInput.inputMode = "text";
    identifierInput.removeAttribute("pattern");
    identifierInput.maxLength = 160;
    identifierInput.placeholder = "أدخلي البريد الإلكتروني";
    passwordField.hidden = false;
    passwordInput.required = true;
    rememberMeLabel.hidden = false;
    loadRememberedLogin();
  }
}

function saveRememberedLogin() {
  if (!rememberMeInput.checked) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    accountType: selectedAccountType,
    identifier: identifierInput.value.trim(),
    password: passwordInput.value
  }));
}

function loadRememberedLogin() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!saved || saved.accountType === "parent") return;

    identifierInput.value = saved.identifier ?? "";
    passwordInput.value = saved.password ?? "";
    rememberMeInput.checked = true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function togglePasswordVisibility() {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePasswordButton.textContent = isPassword ? "🙈" : "👁";
  togglePasswordButton.setAttribute("aria-label", isPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
  togglePasswordButton.setAttribute("aria-pressed", String(isPassword));
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setSelectedTab(tab.dataset.accountType));
});

togglePasswordButton.addEventListener("click", togglePasswordVisibility);
rememberMeInput.addEventListener("change", () => {
  if (!rememberMeInput.checked) {
    localStorage.removeItem(STORAGE_KEY);
  }
});

loadRememberedLogin();

if (demoMode) {
  demoHint.hidden = false;
  setNotice(notice, "success", "وضع التجربة: اختاري ولي الأمر واستخدمي رقم الهوية التجريبي 1234567890.");
}

async function goToDashboardAfterLogin() {
  try {
    const { data } = await api.get("/me");
    if (data?.userType === "parent" || data?.userType === "employee") {
      navigateToDashboardOnce();
      return;
    }
    navigateToDashboardOnce();
  } catch (error) {
    const code = error?.code ?? "";
    const message = code === "INVALID_TOKEN"
      ? "تم تسجيل الدخول في المتصفح، لكن السيرفر لا يصدّق الجلسة الحالية. تحقق من إعدادات Firebase في السيرفر."
      : "تم تسجيل الدخول في المتصفح، لكن لا يمكن فتح MyNas الآن لأن الخادم غير مُهيأ بشكل صحيح.";
    setNotice(notice, "error", message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice(notice);
  if (!form.reportValidity()) return;

  const identifier = form.identifier.value.trim();
  const password = form.password.value;
  if (selectedAccountType === "parent") {
    if (!/^\d{10}$/.test(identifier)) {
      setNotice(notice, "error", "رقم الهوية يجب أن يتكون من 10 أرقام فقط.");
      identifierInput.focus();
      return;
    }
    if (demoMode) {
      if (identifier !== demoParentId || password !== demoParentPassword) {
        setNotice(notice, "error", "رقم الهوية أو كلمة المرور التجريبية غير صحيحة.");
        passwordInput.focus();
        return;
      }
      navigationLocked = true;
      sessionStorage.setItem("nas-login-redirecting", "1");
      safeNavigate("mynas.html?demo=1&parent=1");
      return;
    }
  }

  if (!configurationReady) {
    setNotice(notice, "error", "إعدادات Firebase في الواجهة غير مكتملة. أكملي ملف firebase-config.js قبل المحاولة مرة أخرى.");
    return;
  }

  const email = identifier.toLowerCase();

  await submitSafely(button, async () => {
    try {
      if (rememberMeInput.checked) {
        saveRememberedLogin();
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      if (selectedAccountType === "parent") {
        await loginWithNationalId(identifier, password);
      } else {
        await loginWithEmail(email, password);
      }
      sessionStorage.setItem("nas-login-redirecting", "1");
      await goToDashboardAfterLogin();
    } catch (error) {
      const key = error?.code ?? error?.message ?? "";
      const messages = {
        FIREBASE_CONFIG_REQUIRED: "إعدادات Firebase في الخادم غير مكتملة. أضف ملف خدمة Firebase أو حدّث GOOGLE_APPLICATION_CREDENTIALS قبل تسجيل الدخول.",
        "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة. تأكدي من البيانات ثم حاولي مرة أخرى.",
        "auth/invalid-custom-token": "تعذر اعتماد جلسة ولي الأمر. تحققي من تطابق مشروع Firebase في إعدادات الخادم والواجهة.",
        "auth/custom-token-mismatch": "مشروع Firebase في الخادم لا يطابق مشروع الواجهة. راجعي FIREBASE_PROJECT_ID ثم أعيدي النشر.",
        INVALID_PARENT_CREDENTIALS: "رقم الهوية أو كلمة المرور غير صحيحة.",
        ACCOUNT_INACTIVE: "هذا الحساب غير نشط. يرجى التواصل مع المدرسة.",
        FIREBASE_AUTH_UNAVAILABLE: "تعذر الاتصال بخدمة تسجيل الدخول. حاولي مرة أخرى لاحقًا.",
        "auth/too-many-requests": "تم تسجيل محاولات كثيرة مؤخرًا. انتظري قليلًا ثم حاولي مرة أخرى.",
        "auth/user-disabled": "هذا الحساب موقوف. تواصلي مع مسؤولة النظام.",
        INVALID_TOKEN: "تم تسجيل الدخول في المتصفح، لكن الخادم لا يصدّق الجلسة. تأكدي من إعدادات Firebase في السيرفر.",
        AUTH_REQUIRED: "يجب تسجيل الدخول للمتابعة.",
        "تعذر تسجيل الدخول. تحققي من البيانات وحاولي مجددًا.": "تعذر تسجيل الدخول. تحققي من البيانات وحاولي مجددًا."
      };
      setNotice(notice, "error", messages[key] ?? "تعذر تسجيل الدخول. تحققي من البيانات وحاولي مجددًا.");
    }
  });
});

