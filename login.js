import { api } from "./api.js";
import { firebaseAuth, loginWithEmail } from "./firebase-client.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
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

function setSelectedTab(nextType) {
  selectedAccountType = nextType;
  tabs.forEach((tab) => {
    const isActive = tab.dataset.accountType === nextType;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  const isParent = nextType === "parent";
  if (isParent && demoMode) {
    identifierLabel.textContent = "رقم الهوية التجريبي";
    identifierInput.type = "text";
    identifierInput.inputMode = "numeric";
    identifierInput.pattern = "[0-9]{10}";
    identifierInput.maxLength = 10;
    identifierInput.placeholder = "أدخلي رقم الهوية";
    passwordField.hidden = !demoMode;
    passwordInput.required = demoMode;
    passwordInput.value = "";
    passwordInput.placeholder = demoMode ? "كلمة المرور التجريبية" : "";
    rememberMeInput.checked = false;
    localStorage.removeItem(STORAGE_KEY);
  } else {
    identifierLabel.textContent = "البريد الإلكتروني";
    identifierInput.type = "text";
    identifierInput.inputMode = "text";
    identifierInput.pattern = "";
    identifierInput.maxLength = 160;
    identifierInput.placeholder = "أدخلي البريد الإلكتروني";
    passwordField.hidden = false;
    passwordInput.required = true;
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
    const destination = data.userType === "parent" ? "mynas.html" : "mynas.html";
    window.location.replace(destination);
  } catch {
    window.location.replace("mynas.html");
  }
}

onAuthStateChanged(firebaseAuth, (user) => {
  if (user) {
    goToDashboardAfterLogin();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice(notice);
  if (!form.reportValidity()) return;

  const identifier = form.identifier.value.trim();
  const password = form.password.value;
  if (selectedAccountType === "parent" && demoMode) {
    if (!/^\d{10}$/.test(identifier)) {
      setNotice(notice, "error", "رقم الهوية يجب أن يتكون من 10 أرقام فقط.");
      identifierInput.focus();
      return;
    }
    if (demoMode && identifier === demoParentId) {
      if (password !== demoParentPassword) {
        setNotice(notice, "error", "كلمة المرور التجريبية غير صحيحة.");
        passwordInput.focus();
        return;
      }
      window.location.replace("mynas.html?demo=1&parent=1");
      return;
    }
  }

  const email = identifier.toLowerCase();

  await submitSafely(button, async () => {
    try {
      if (rememberMeInput.checked) {
        saveRememberedLogin();
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      await loginWithEmail(email, password);
      await goToDashboardAfterLogin();
    } catch (error) {
      const messages = {
        FIREBASE_CONFIG_REQUIRED: "يجب أولًا إدخال إعدادات Firebase العامة في ملف firebase-config.js.",
        "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        "auth/too-many-requests": "تمت محاولات دخول كثيرة. انتظري قليلًا ثم حاولي مجددًا.",
        "auth/user-disabled": "هذا الحساب موقوف. تواصلي مع مسؤولة النظام."
      };
      setNotice(notice, "error", messages[error.code ?? error.message] ?? "تعذر تسجيل الدخول. تحققي من البيانات وحاولي مجددًا.");
    }
  });
});

