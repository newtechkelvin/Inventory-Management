// db.js - Firebase Firestore 庫存管理數據串接模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  runTransaction, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase 配置 (請更換為你的 Firebase Config)
const firebaseConfig = {
  apiKey: "AIzaSyAVSqdFFoepdwrRtxGjyoSBPwHlfxORGd8",
  authDomain: "newtech-system.firebaseapp.com",
  projectId: "newtech-system",
  storageBucket: "newtech-system.firebasestorage.app",
  messagingSenderId: "871887832252",
  appId: "1:871887832252:web:bd02bbb128616a5187fcb9",
  measurementId: "G-QTTFP959KP"
};

// 初始化 Firebase 與 Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firestore 集合名稱定義
const PRODUCTS_COLLECTION = "products";
const TRANSACTIONS_COLLECTION = "inventory_transactions";

// ==========================================
// 2. 產品檔 (Products) CRUD 操作
// ==========================================

/**
 * 獲取所有商品列表 (支援類別篩選與即時關鍵字過濾)
 * @param {Object} filters - { category, searchQuery }
 * @returns {Array} 商品資料陣列
 */
export async function fetchProducts(filters = {}) {
  try {
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    let q = query(productsRef, orderBy("updated_at", "desc"));

    if (filters.category) {
      q = query(productsRef, where("category", "==", filters.category), orderBy("updated_at", "desc"));
    }

    const snapshot = await getDocs(q);
    let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 前端關鍵字搜尋 (模糊匹配 Name / SKU)
    if (filters.searchQuery) {
      const term = filters.searchQuery.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(term) || 
        (p.sku && p.sku.toLowerCase().includes(term))
      );
    }

    return { success: true, data: products };
  } catch (error) {
    console.error("Fetch products failed:", error);
    return { success: false, message: "讀取庫存資料失敗: " + error.message };
  }
}

/**
 * 新增產品
 * @param {Object} productData 
 */
export async function createProduct(productData) {
  try {
    const newProduct = {
      name: productData.name,
      category: productData.category || "未分類",
      sku: productData.sku || "",
      unit_price: Number(productData.unit_price) || 0,
      cost_price: Number(productData.cost_price) || 0,
      stock_quantity: Number(productData.stock_quantity) || 0,
      min_stock_alert: Number(productData.min_stock_alert) || 10,
      unit: productData.unit || "個",
      status: "Active",
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), newProduct);
    return { success: true, id: docRef.id, message: "商品建立成功！" };
  } catch (error) {
    console.error("Create product failed:", error);
    return { success: false, message: "新增商品失敗: " + error.message };
  }
}

/**
 * 更新產品資料
 * @param {string} productId 
 * @param {Object} updateData 
 */
export async function updateProduct(productId, updateData) {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);
    await updateDoc(docRef, {
      ...updateData,
      updated_at: serverTimestamp()
    });
    return { success: true, message: "商品更新成功！" };
  } catch (error) {
    console.error("Update product failed:", error);
    return { success: false, message: "更新失敗: " + error.message };
  }
}

/**
 * 刪除產品
 * @param {string} productId 
 */
export async function deleteProduct(productId) {
  try {
    await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId));
    return { success: true, message: "商品已刪除！" };
  } catch (error) {
    console.error("Delete product failed:", error);
    return { success: false, message: "刪除失敗: " + error.message };
  }
}

// ==========================================
// 3. 庫存出入庫交易 (Inventory Transaction Process)
// ==========================================

/**
 * 出入庫 / 盤點異動 (採用 Transaction 確保數據一致性)
 * @param {Object} params - { productId, type: 'IN'|'OUT'|'ADJUST', quantity, handler, remark }
 */
export async function recordTransaction({ productId, type, quantity, handler = "Admin", remark = "" }) {
  const qtyNum = Number(quantity);
  if (isNaN(qtyNum) || qtyNum <= 0) {
    return { success: false, message: "異動數量必須為大於 0 的數字" };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, PRODUCTS_COLLECTION, productId);
      const productDoc = await transaction.get(productRef);

      if (!productDoc.exists()) {
        throw new Error("找不到該商品！");
      }

      const productData = productDoc.data();
      const currentStock = Number(productData.stock_quantity) || 0;
      let newStock = currentStock;

      if (type === "IN") {
        newStock = currentStock + qtyNum;
      } else if (type === "OUT") {
        if (currentStock < qtyNum) {
          throw new Error(`庫存不足！現有庫存：${currentStock}，嘗試扣減：${qtyNum}`);
        }
        newStock = currentStock - qtyNum;
      } else if (type === "ADJUST") {
        newStock = qtyNum; // 直接修正庫存值
      } else {
        throw new Error("無效的異動類型 (必須為 IN, OUT, 或 ADJUST)");
      }

      // 1. 更新產品 Table 嘅庫存數量
      transaction.update(productRef, {
        stock_quantity: newStock,
        updated_at: serverTimestamp()
      });

      // 2. 寫入異動紀錄 Log
      const newTxnRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      transaction.set(newTxnRef, {
        product_id: productId,
        product_name: productData.name,
        type: type,
        quantity: qtyNum,
        before_stock: currentStock,
        after_stock: newStock,
        handler: handler,
        remark: remark,
        created_at: serverTimestamp()
      });
    });

    return { success: true, message: "庫存異動更新成功！" };
  } catch (error) {
    console.error("Transaction failed:", error);
    return { success: false, message: error.message };
  }
}

// ==========================================
// 4. 統計數據 Dashboard Analytics
// ==========================================

/**
 * 獲取 Dashboard 頂部 4 個統計卡片數據
 */
export async function fetchDashboardMetrics() {
  try {
    const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
    let totalSKUs = 0;
    let totalStockValue = 0;
    let lowStockCount = 0;

    snapshot.forEach(doc => {
      const item = doc.data();
      totalSKUs += 1;
      const qty = Number(item.stock_quantity) || 0;
      const cost = Number(item.cost_price) || 0;
      const minAlert = Number(item.min_stock_alert) || 10;

      totalStockValue += (qty * cost);
      if (qty <= minAlert) {
        lowStockCount += 1;
      }
    });

    return {
      success: true,
      data: {
        totalSKUs,
        totalStockValue,
        lowStockCount
      }
    };
  } catch (error) {
    console.error("Fetch metrics failed:", error);
    return { success: false, message: "計算統計數據失敗: " + error.message };
  }
}
