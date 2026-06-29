const ES_LOCAL =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

const CONFIG = {

  API_URL: ES_LOCAL
    ? "http://localhost:8080/api/v1"
    : "https://erpinventario.duckdns.org/api/v1",

  WS_URL: ES_LOCAL
    ? "http://localhost:8080/api/v1/ws"
    : "https://erpinventario.duckdns.org/api/v1/ws",

  getData() {
    return JSON.parse(
      localStorage.getItem("data")
    );
  }
};