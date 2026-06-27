const CONFIG = {
  API_URL:
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
      ? "http://localhost:8080/api/v1"
      : "http://18.117.216.163/api/v1",

  getData() {
    return JSON.parse(localStorage.getItem("data"));
  }
};