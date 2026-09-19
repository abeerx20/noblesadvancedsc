function applyDataLanguage() {
    const lang = document.documentElement.lang === "en" ? "en" : "ar";
    const toEnglish = lang === "en";

    document.querySelectorAll("[data-ar][data-en]").forEach((element) => {
        element.textContent = toEnglish ? (element.dataset.en || element.textContent) : (element.dataset.ar || element.textContent);
    });

    document.querySelectorAll("[data-ar-alt][data-en-alt]").forEach((element) => {
        const value = toEnglish ? (element.dataset.enAlt || element.getAttribute("alt")) : (element.dataset.arAlt || element.getAttribute("alt"));
        if (value) element.setAttribute("alt", value);
    });
}

function setLanguage(language) {
    const toEnglish = language === "en";
    document.documentElement.lang = toEnglish ? "en" : "ar";
    document.documentElement.dir = toEnglish ? "ltr" : "rtl";
    document.body.classList.toggle("language-english", toEnglish);

    applyDataLanguage();

    const languageLink = document.querySelector(".language-toggle");
    if (languageLink) languageLink.textContent = toEnglish ? "العربية" : "English";
    document.title = toEnglish ? "Advanced Al-Nubala Schools" : "مدارس النبلاء المتقدمة";
    localStorage.setItem("nas-language", language);
}

function initLanguageToggle() {
    const languageLink = [...document.querySelectorAll("a, button")].find((element) => {
        const text = (element.textContent || "").trim();
        return text === "English" || text === "العربية";
    });

    if (!languageLink) return;

    languageLink.classList.add("language-toggle");
    languageLink.href = "#";
    languageLink.addEventListener("click", (event) => {
        event.preventDefault();
        const nextLanguage = document.documentElement.lang === "en" ? "ar" : "en";
        setLanguage(nextLanguage);
    });

    setLanguage(localStorage.getItem("nas-language") === "en" ? "en" : "ar");
}

document.addEventListener("DOMContentLoaded", initLanguageToggle);
