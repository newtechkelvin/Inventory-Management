// app.js - 前端 UI 事件監聽與資料渲染
import { fetchProducts, createProduct, recordTransaction, fetchDashboardMetrics } from './db.js';

// 初始化渲染 Table
async function renderInventoryTable() {
  const searchQuery = document.querySelector('input[placeholder*="搜尋"]').value;
  const category = document.querySelector('select').value;

  // 1. 取得資料
  const result = await fetchProducts({ searchQuery, category });
  if (!result.success) {
    alert(result.message);
    return;
  }

  const tbody = document.querySelector('tbody');
  tbody.innerHTML = '';

  // 2. 渲染 Table Rows
  result.data.forEach(item => {
    const isLowStock = item.stock_quantity <= item.min_stock_alert;
    
    const rowHtml = `
      <tr class="hover:bg-slate-700/30 transition ${isLowStock ? 'bg-rose-950/10' : ''}">
        <td class="py-4 px-4">
          <div class="font-semibold text-white">${item.name}</div>
          <div class="text-xs text-slate-500">SKU: ${item.sku}</div>
        </td>
        <td class="py-4 px-4"><span class="bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-md">${item.category}</span></td>
        <td class="py-4 px-4">
          <div class="text-white font-medium">$${item.unit_price.toFixed(2)}</div>
          <div class="text-xs text-slate-500">成本: $${item.cost_price.toFixed(2)}</div>
        </td>
        <td class="py-4 px-4">
          <div class="font-semibold ${isLowStock ? 'text-rose-400' : 'text-white'}">${item.stock_quantity} ${item.unit}</div>
          <div class="text-xs text-slate-400">預警線: ${item.min_stock_alert}</div>
        </td>
        <td class="py-4 px-4">
          ${isLowStock ? `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> 低於安全庫存
            </span>
          ` : `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 庫存充裕
            </span>
          `}
        </td>
        <td class="py-4 px-4 text-right space-x-2">
          <button onclick="handleQuickTxn('${item.id}')" class="text-indigo-400 hover:text-indigo-300 font-medium text-xs">出/入庫</button>
          <button onclick="handleDelete('${item.id}')" class="text-rose-400 hover:text-rose-300 font-medium text-xs">刪除</button>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHtml);
  });
}

// 快速出入庫按鈕 Action 範例
window.handleQuickTxn = async function(productId) {
  const type = prompt("請輸入動作 (IN: 入庫, OUT: 出庫):", "IN");
  if (!type) return;

  const qty = prompt("請輸入數量:", "10");
  if (!qty) return;

  const res = await recordTransaction({
    productId: productId,
    type: type.toUpperCase(),
    quantity: Number(qty),
    handler: "Admin",
    remark: "手動出入庫操作"
  });

  alert(res.message);
  if (res.success) {
    renderInventoryTable(); // 重新整理畫面
  }
};
