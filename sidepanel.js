// LazyMan AI Assistant - Side Panel Logic
document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const chatContainer = document.getElementById("chatContainer");
  const userInput = document.getElementById("userInput");
  const btnSend = document.getElementById("btnSend");
  const chkIncludePage = document.getElementById("chkIncludePageContext");
  const btnSettings = document.getElementById("btnSettings");
  const settingsPanel = document.getElementById("settingsPanel");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const modelSelect = document.getElementById("modelSelect");
  const btnSaveSettings = document.getElementById("btnSaveSettings");
  const saveStatus = document.getElementById("saveStatus");
  const apiKeyNotice = document.getElementById("apiKeyNotice");
  const btnOpenSettingsNotice = document.getElementById("btnOpenSettingsNotice");
  const btnClearChat = document.getElementById("btnClearChat");
  const quickActionBtns = document.querySelectorAll(".pill-btn");

  let apiKey = "";
  let selectedModel = "gemini-1.5-flash";
  let isGenerating = false;

  // 1. Tải cấu hình đã lưu
  chrome.storage.local.get(["geminiApiKey", "selectedModel", "chatHistory"], (result) => {
    if (result.geminiApiKey) {
      apiKey = result.geminiApiKey;
      apiKeyInput.value = apiKey;
      apiKeyNotice.classList.add("hidden");
    } else {
      apiKeyNotice.classList.remove("hidden");
    }

    if (result.selectedModel) {
      selectedModel = result.selectedModel;
      modelSelect.value = selectedModel;
    }

    if (result.chatHistory && result.chatHistory.length > 0) {
      renderChatHistory(result.chatHistory);
    }
  });

  // 2. Mở/đóng phần Cài đặt
  btnSettings.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  btnOpenSettingsNotice.addEventListener("click", () => {
    settingsPanel.classList.remove("hidden");
    apiKeyInput.focus();
  });

  // 3. Lưu Cài đặt API
  btnSaveSettings.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!key) {
      saveStatus.textContent = "Vui lòng nhập API Key!";
      saveStatus.style.color = "#ef4444";
      return;
    }

    chrome.storage.local.set({ geminiApiKey: key, selectedModel: model }, () => {
      apiKey = key;
      selectedModel = model;
      saveStatus.textContent = "Đã lưu thành công! ✅";
      saveStatus.style.color = "#10b981";
      apiKeyNotice.classList.add("hidden");

      setTimeout(() => {
        saveStatus.textContent = "";
        settingsPanel.classList.add("hidden");
      }, 1200);
    });
  });

  // 4. Xóa lịch sử chat
  btnClearChat.addEventListener("click", () => {
    if (confirm("Bạn có chắc muốn xóa lịch sử đoạn chat này không?")) {
      chrome.storage.local.remove("chatHistory", () => {
        chatContainer.innerHTML = `
          <div class="message ai-message">
            <div class="msg-header"><span class="bot-name">LazyMan AI</span></div>
            <div class="msg-content">
              Đoạn chat đã được làm mới! Sẵn sàng phục vụ bạn ☕.
            </div>
          </div>
        `;
      });
    }
  });

  // 5. Tự động co giãn ô nhập
  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  });

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  btnSend.addEventListener("click", handleSend);

  // 6. Xử lý các nút tác vụ nhanh (Quick Actions)
  quickActionBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (isGenerating) return;
      const action = btn.dataset.action;

      let prompt = "";
      if (action === "summarize") {
        prompt = "Hãy tóm tắt nội dung chính của trang web này một cách súc tích, dễ hiểu nhất (chỉ nêu 3-5 ý cốt lõi quan trọng nhất, dùng emoji và gạch đầu dòng).";
      } else if (action === "extract_data") {
        prompt = "Bóc tách toàn bộ dữ liệu quan trọng trên trang này (bao gồm: giá cả, bảng số liệu, thông số kỹ thuật, email, SĐT nếu có). Trình bày ngăn nắp dạng danh sách.";
      } else if (action === "analyze_product") {
        prompt = "Phân tích sản phẩm/dịch vụ trên trang: Tên, giá bán, điểm nổi bật, và đánh giá ưu/nhược điểm ngắn gọn.";
      } else if (action === "translate_vi") {
        prompt = "Dịch và tinh gọn nội dung cốt lõi của trang này sang tiếng Việt tự nhiên, ngắn gọn nhất.";
      }

      await executePrompt(prompt, true);
    });
  });

  // 7. Gửi câu hỏi thủ công
  async function handleSend() {
    const text = userInput.value.trim();
    if (!text || isGenerating) return;

    userInput.value = "";
    userInput.style.height = "auto";
    const includePage = chkIncludePage.checked;

    await executePrompt(text, includePage);
  }

  // 8. Thực thi Prompt gửi tới Gemini
  async function executePrompt(userPromptText, includePageContext) {
    if (!apiKey) {
      settingsPanel.classList.remove("hidden");
      apiKeyNotice.classList.remove("hidden");
      apiKeyInput.focus();
      appendMessage("ai", "⚠️ Bạn chưa nhập Gemini API Key. Hãy bấm vào cài đặt phía trên để nhập key miễn phí từ Google nhé!");
      return;
    }

    appendMessage("user", userPromptText);
    isGenerating = true;
    btnSend.disabled = true;

    const typingMsg = appendTypingIndicator();

    try {
      let pageContext = "";
      if (includePageContext) {
        pageContext = await getActiveTabContext();
      }

      // Xây dựng nội dung gửi tới Gemini
      let fullMessage = userPromptText;
      if (pageContext) {
        fullMessage = `[THÔNG TIN TRANG WEB HIỆN TẠI]\nTiêu đề: ${pageContext.title}\nURL: ${pageContext.url}\nNội dung trích xuất:\n${pageContext.text}\n\n---\n[YÊU CẦU CỦA NGƯỜI DÙNG]:\n${userPromptText}`;
      }

      const responseText = await callGeminiAPI(fullMessage);
      typingMsg.remove();
      appendMessage("ai", responseText);
      saveChatHistory();
    } catch (err) {
      typingMsg.remove();
      appendMessage("ai", `❌ Lỗi: ${err.message || "Không thể kết nối tới Gemini API. Vui lòng kiểm tra lại API Key hoặc mạng."}`);
    } finally {
      isGenerating = false;
      btnSend.disabled = false;
    }
  }

  // 9. Lấy nội dung từ Tab đang mở
  async function getActiveTabContext() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
        return null;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection().toString().trim();
          const title = document.title || "";
          const url = window.location.href;
          
          // Lấy text trên trang (cắt ngắn 12000 ký tự đầu tiên để tối ưu tốc độ)
          const text = (document.body ? document.body.innerText : "")
            .replace(/\s+/g, " ")
            .slice(0, 12000);

          return { title, url, text: selection ? `(Đoạn văn bản bôi đen): ${selection}\n\n${text}` : text };
        },
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
    } catch (e) {
      console.warn("Không thể trích xuất nội dung từ tab:", e);
    }
    return null;
  }

  // 10. Gọi Gemini REST API
  async function callGeminiAPI(promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const systemInstruction = `Bạn là LazyMan AI - trợ lý theo phương châm 'Đưa mọi thứ về đơn giản nhất, lười hơn để thành công hơn'. 
Nhiệm vụ của bạn là giải quyết công việc nhanh nhất có thể cho người dùng, trả lời súc tích, đúng trọng tâm, gạch đầu dòng rõ ràng, không vòng vo rườm rà. Nếu trích xuất bảng biểu hay dữ liệu hãy dùng Markdown đẹp mắt.`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.error?.message || `Mã lỗi HTTP ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (candidate && candidate.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text;
    }
    throw new Error("Không nhận được câu trả lời từ mô hình AI.");
  }

  // 11. Hiển thị tin nhắn lên giao diện
  function appendMessage(role, text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${role}-message`;

    if (role === "ai") {
      msgDiv.innerHTML = `
        <div class="msg-header">
          <span class="bot-name">LazyMan AI ☕</span>
        </div>
        <div class="msg-content">${formatMarkdown(text)}</div>
        <div class="msg-actions">
          <button class="action-copy-btn">📋 Sao chép</button>
        </div>
      `;

      // Nút sao chép
      const copyBtn = msgDiv.querySelector(".action-copy-btn");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "✅ Đã sao chép";
          setTimeout(() => { copyBtn.textContent = "📋 Sao chép"; }, 1500);
        });
      });
    } else {
      msgDiv.innerHTML = `<div class="msg-content">${escapeHtml(text)}</div>`;
    }

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msgDiv;
  }

  // 12. Hiệu ứng đang gõ (Typing Indicator)
  function appendTypingIndicator() {
    const msgDiv = document.createElement("div");
    msgDiv.className = "message ai-message";
    msgDiv.innerHTML = `
      <div class="msg-header"><span class="bot-name">LazyMan AI ☕</span></div>
      <div class="msg-content">
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msgDiv;
  }

  // 13. Định dạng Markdown đơn giản
  function formatMarkdown(content) {
    if (!content) return "";
    let html = escapeHtml(content);

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Bullet points
    html = html.replace(/^\s*[\*\-]\s+(.*)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
    // Line breaks
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // 14. Lưu và khôi phục lịch sử chat
  function saveChatHistory() {
    const messages = [];
    const msgElements = chatContainer.querySelectorAll(".message");
    msgElements.forEach((el) => {
      const isUser = el.classList.contains("user-message");
      const contentEl = el.querySelector(".msg-content");
      if (contentEl) {
        messages.push({
          role: isUser ? "user" : "ai",
          text: contentEl.innerText
        });
      }
    });

    // Chỉ lưu 20 tin nhắn gần nhất
    chrome.storage.local.set({ chatHistory: messages.slice(-20) });
  }

  function renderChatHistory(history) {
    chatContainer.innerHTML = "";
    history.forEach((msg) => {
      appendMessage(msg.role, msg.text);
    });
  }
});
