export function getApiErrorMessage(error, fallback = "Something went wrong") {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return message || fallback;
}

export function withApiErrorFallback(error, fallback = "Something went wrong") {
  return getApiErrorMessage(error, fallback);
}
