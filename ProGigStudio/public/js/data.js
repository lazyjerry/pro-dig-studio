/*
需要指定參數
	const API_BASE = "/api/data";
  const DATA_TYPE = "quote";

  toast.js
  */

//取得 ?id=xx
function getItemID() {
	const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  console.log("getItemID",`id ${id}`);
	return id;
}

// 取得設定檔案 目前有 logoUrl
/*
  需要一個 function 當參數，e.g.
  const configCallback = function (result){
   $("#logoUrl").val(result.logoUrl);
  }
*/
async function getConfig(callback) {
	const res = await fetch(`${API_BASE}/config`, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
	});
	if (!res.ok) throw new Error("SERVER_ERROR");

	const result = await res.json();
	callback(result);
}

// 讀取單筆資料
async function readData(id) {
	try {
		// ➊ 送新增請求
		const url = `${API_BASE}/${id}`;
		const res = await fetch(url, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) throw new Error("SERVER_ERROR");

		const result = await res.json();
    // console.log("readData" , result);
		return result.info;
	} catch (err) {
		console.error(err);
		return null;
	}
}

/**
 * 儲存資料（同時段僅允許 1 個請求）
 * @param {string}   name
 * @param {Object}   info
 * @param {Function} callback  (boolean success) => void
 * @returns {Promise<boolean>} true 成功 / false 失敗或被鎖定
 */
async function saveData (name, info, callback = null) {
  /* ---------- 互斥鎖：若正在存檔就拒絕 ---------- */
  if (saveData._busy) {
    console.warn('saveData 正在執行中，已忽略重複呼叫');
    callback?.(false);                      // 讓 UI 知道沒有成功
    return false;
  }
  saveData._busy = true;                    // 上鎖

  /* ---------- 主要邏輯 ---------- */
  const id      = getItemID();
  let   apiUrl  = API_BASE;
  let   method  = 'POST';

  if (id && id > 0) {
    apiUrl = `${API_BASE}/${id}`;
    method = 'PUT';
  }

  console.log("saveData","is Update "+ (id && id > 0));

  try {
    const res = await fetch(apiUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: DATA_TYPE, name, info })
    });
    if (!res.ok) throw new Error('SERVER_ERROR');

    const result = await res.json();

    // ------- 新增時：更新網址 -------
    if (!id || id <= 0) {
      const newID = result?.id;


      console.log("saveData", result);
      console.log("saveData newID", newID);

      if (newID) {
        const newURL = `${location.origin}${location.pathname}?id=${newID}`;
        console.log('saveData','newURL'+ newURL);
        history.pushState({ path: newURL }, '', newURL);
      }
    }

    showToast("資料已保存", "success");
    callback?.(true);
    return true;                            // ← 成功
  } catch (err) {
    console.error(err);
    alert('保存失敗，請稍後再試');
    callback?.(false);
    return false;                           // ← 失敗
  } finally {
    saveData._busy = false;                 // 解鎖 (成功/失敗皆執行)
  }
}

/* 初始化鎖狀態 */
saveData._busy = false;