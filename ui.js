export function setNotice(element, type, message) {
  element.className = `notice visible notice-${type}`;
  element.textContent = message;
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function clearNotice(element) {
  element.className = "notice";
  element.textContent = "";
}

export async function submitSafely(button, task) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "جارٍ التنفيذ...";
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

export function createCell(value) {
  const td = document.createElement("td");
  td.textContent = value ?? "—";
  return td;
}

export function fillSelect(select, items, getValue, getLabel, placeholder = "اختاري") {

  if (!select) {
    console.error("fillSelect received null element");
    return;
  }

  select.replaceChildren();

  const initial = document.createElement("option");
  initial.value = "";
  initial.textContent = placeholder;
  select.append(initial);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = getValue(item);
    option.textContent = getLabel(item);
    select.append(option);
  });
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(date);
}

