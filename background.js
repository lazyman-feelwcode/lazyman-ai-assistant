// Tự động mở Side Panel khi người dùng bấm vào biểu tượng Extension trên thanh công cụ
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Lỗi cấu hình SidePanel:", error));
