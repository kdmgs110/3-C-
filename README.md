# 3年B組

- 好きな女性の顔をLINEに投稿すると、その顔に似たAV女優を返してくれるLine Botのスクリプトです。
- Line API ⇒ Google Apps Script ⇒ Face API ⇒ Google Apps Script ⇒ DMM API ⇒ Google Apps Script ⇒ Line API という流れで処理をしています。
- Google Apps Scriptで処理をしています。

# 詰まっているところ

- Face API detectに、バイナリ形式の画像を送る際に、エラーがでて困っています。
- Pythonから画像URLを送信するときは動いたのですが、Google Apps Scriptから、バイナリ形式の画像データを送信する場合のときだけ、なぜかうまくいきません。
- 以下のコードを処理した際に、エラーがでます

```js:

function detectFaceId(imageBlob){

  end_point = FACE_API_BASE_END_POINT + "detect"

  try {
    /*
    payload = {
      "file":imageBlob
    }
    */
    payload = imageBlob
    headers = {
      "Ocp-Apim-Subscription-Key": FACE_API_SUBSCRIPTION_KEY,
      "Content-Type": "application/octet-stream"
    };

    var res = UrlFetchApp.fetch(
      end_point,
      {
        'method': 'POST',
        'headers': headers,
        'payload': JSON.stringify(payload)
      }
    );

    res = JSON.parse(res)
    faceId = res[0]["faceId"]
    Logger.log("faceId: " + faceId)
    return faceId

  } catch (e){
    Logger.log("faceIdの取得に失敗しました")
    Logger.log("エラーメッセージ：" + e)
    return e
  }
}

```

- エラーの内容は次の通りです。
```
[18-03-19 23:30:26:133 JST] エラーメッセージ：Exception: https://westcentralus.api.cognitive.microsoft.com/face/v1.0/detect のリクエストに失敗しました（エラー: 400）。サーバー応答の一部: {"error":{"code":"InvalidImageSize","message":"Image size is too small."}}（応答の全文を見るには muteHttpExceptions オプションを使用してください）

```

# 今まで調査したこと

- 画像URLからバイナリ形式で画像を保存できていないかと思ったのですが、取得した画像をGoogle Drive上に保存することができたので、バイナリ形式で画像が保存できていないことはありませんでした。
- なので、{"code":"InvalidImageSize","message":"Image size is too small."} と書かれていたとしても、取得しているファイル自体の重さは関係ないように思えます。


# 参考URL

- Face API
https://westus.dev.cognitive.microsoft.com/docs/services/563879b61984550e40cbbe8d/operations/563879b61984550f30395236
