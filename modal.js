// modal.js - 控制出入庫 Modal 視窗與 UI 互動邏輯
import { recordTransaction } from './db.js';

/**
 * 開啟出入庫 Modal
 * @param {string} productId - 商品 ID
 * @param {string} productName - 商品名稱
 * @param {number} currentStock - 現有庫存
 */
window.openTxnModal = function(productId, productName, currentStock) {
  document.getElementById('modalProductId').value = productId;
  document.getElementById('modalCurrentStock').value = currentStock;
  document.getElementById('modalProductName').textContent = `商品：${productName}`;
  document.getElementById('modalStockDisplay').textContent = `${currentStock} 個`;
  
  // 重置表單欄位
  document.getElementById('txnQuantity').value = '';
  document.getElementById('txnRemark').value = '';
  document.querySelectorAll('input[name="txnType"]')[0].checked = true; // 預設選 IN
  
  updateStockPreview();
  
  // 顯示 Modal
  const modal = document.getElementById('txnModal');
  modal.classList.remove('hidden');
};

/**
 * 關閉 Modal
 */
window.closeTxnModal = function() {
  const modal = document.getElementById('txnModal');
  modal.classList.add('hidden');
};

/**
 * 計算並即時顯示「更新後庫存」預覽
 */
window.updateStockPreview = function() {
  const currentStock = Number(document.getElementById('modalCurrentStock').value) || 0;
  const qtyInput = Number(document.getElementById('txnQuantity').value) || 0;
  const type = document.querySelector('input[name="txnType"]:checked').value;
  const previewEl = document.getElementById('stockPreviewText');
  const submitBtn = document.getElementById('submitBtn');

  let estimatedStock = currentStock;

  if (type === 'IN') {
    estimatedStock = currentStock + qtyInput;
  } else if (type === 'OUT') {
    estimatedStock = currentStock - qtyInput;
  } else if (type === 'ADJUST') {
    estimatedStock = qtyInput;
  }

  // 處理庫存不足警告
  if (estimatedStock < 0) {
    previewEl.className = "text-xs text-rose-400 font-bold";
    previewEl.textContent = `⚠️ 警告：庫存將低於 0 (${estimatedStock})`;
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    previewEl.className = "text-xs text-indigo-400 font-medium";
    previewEl.textContent = `預計更新後庫存：${estimatedStock} 個`;
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
};

/**
 * 表單提交處理
 */
window.submitTxnForm = async function(event) {
  event.preventDefault();

  const productId = document.getElementById('modalProductId').value;
  const type = document.querySelector('input[name="txnType"]:checked').value;
  const quantity = Number(document.getElementById('txnQuantity').value);
  const handler = document.getElementById('txnHandler').value || 'Admin User';
  const remark = document.getElementById('txnRemark').value;

  const submitBtn = document.getElementById('submitBtn');
  const originalBtnText = submitBtn.innerHTML;
  
  try {
    // 設置 Loading 狀態
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>處理中...</span>`;

    // 呼叫 DB 模組發起 Firebase Transaction
    const result = await recordTransaction({
      productId,
      type,
      quantity,
      handler,
      remark
    });

    if (result.success) {
      alert("✅ " + result.message);
      closeTxnModal();
      
      // 觸發 Table 重新渲染（若有定義全域 renderInventoryTable）
      if (typeof window.renderInventoryTable === 'function') {
        window.renderInventoryTable();
      }
    } else {
      alert("❌ 操作失敗: " + result.message);
    }
  } catch (error) {
    alert("❌ 系統發生錯誤: " + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
};
