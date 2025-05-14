/*
	const API_BASE = "/api/data";
  const DATA_TYPE = "quote";
  */ 

//取得 ?id=xx
function getItemID(){
 const urlParams = new URLSearchParams(window.location.search);
 return urlParams.get("id");
}

// 取得設定檔案 目前有 logoUrl
async function getConfig(){
  const res = await fetch(`${API_BASE}/${config}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("SERVER_ERROR");

    return await res.json();
}

// 讀取單筆資料
async function readData(id){
  try {
    // ➊ 送新增請求
    const url = `${API_BASE}/${id}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error("SERVER_ERROR");

    const result = await res.json();
   
     console.log("result",result.info);
    return result.info;

  } catch (err) {
    console.error(err);
    return null;
  }
}


async function saveData(name, info) {
  const id = getItemID();
  let apiUrl = API_BASE;
  let method = "POST";
  if(id && id > 0){
    apiUrl = `${API_BASE}/${id}`;
    method = "PUT";
  }
  try {
    const res = await fetch(apiUrl, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: DATA_TYPE, name, info }),
    });
    if (!res.ok) throw new Error("SERVER_ERROR");

    console.log("save", id);
    
    const result = await res.json();
    console.log(result);
    console.log("save", id);
    if (!id || id <= 0) {
      // 如果沒有 id，表示新建，從回傳結果取得新 id 並更新網址
      if (result && result.info && result.info.id) {
      const newUrl = window.location.origin + window.location.pathname + "?id=" + result.info.id;
      console.log("newUrl",newUrl);
        window.history.pushState({ path: newUrl }, "", newUrl);
      }
    }

    return true;
  } catch (err) {
    console.error(err);
    alert("新增失敗，請稍後再試");
    return null;
  }
}