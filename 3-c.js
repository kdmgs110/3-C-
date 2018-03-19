// プロパティ取得
var PROPERTIES = PropertiesService.getScriptProperties();//ファイル > プロジェクトのプロパティから設定した環境変数的なもの

//Google Driveの画像を保存するフォルダの設定

var GOOGLE_DRIVE_FOLDER_ID = PROPERTIES.getProperty('GOOGLE_DRIVE_FOLDER_ID')

//LINE・DMMの設定をプロジェクトのプロパティから取得
var LINE_ACCESS_TOKEN = PROPERTIES.getProperty('LINE_ACCESS_TOKEN')
var LINE_END_POINT = "https://api.line.me/v2/bot/message/reply"

//GYASOの設定

var GYASO_ACCESS_TOKEN = PROPERTIES.getProperty("GYASO_ACCESS_TOKEN")

//MicroSoft Azure Face APIの設定
var FACE_API_SUBSCRIPTION_KEY = PROPERTIES.getProperty('FACE_API_SUBSCRIPTION_KEY')
var FACE_API_PERSON_GROUP = "avactress"
var FACE_API_BASE_END_POINT = "https://westcentralus.api.cognitive.microsoft.com/face/v1.0/"

//DMMの設定
var DMM_API_ID = PROPERTIES.getProperty('DMM_API_ID')
var DMM_AFFILIATE_ID = PROPERTIES.getProperty('DMM_AFFILIATE_ID')

var reply_token;
var imageUrl;
var id;

//LINEのエンドポイント

function doGet() {
  return HtmlService.createTemplateFromFile("test").evaluate();
}

/* 処理内容

  ・LINEから画像バイナリファイルを取得
  ・バイナリファイルをMicrosoft Azure Face APIに送信
  ・Face APIから取得したAV女優名をもとに、DMM APIから女優の画像とリンクを取得
  ・LINEに　
    ・AV女優名
    ・合致度
    ・女優画像
    ・女優URLを返信
  ・合致しなかった場合、女優追加申請フォームを返す。
*/


//LINEからPOSTリクエストを受けたときに起動する
function doPost(e){

  if (typeof e === "undefined"){
    /*
     * debug用の処理です
     * imageUrlに、任意のAV女優の画像を挿入しています。
    */
    imageEndPoint = "https://i.pinimg.com/originals/63/36/83/63368380ebec93d8abde0759703c42f4.jpg" //検証用の画像
  } else {

    /*
     * Lineからメッセージが送られたときの処理です
     * LineのmessageIdを取得し、そこからバイナリ形式の画像データを取得します
    */

    //messageIdから、Line上に存在するバイナリ形式の画像URLを取得します

    var json = JSON.parse(e.postData.contents);
    reply_token= json.events[0].replyToken;
    var messageId = json.events[0].message.id;
    imageEndPoint = 'https://api.line.me/v2/bot/message/'+ messageId +'/content/' //バイナリファイルの画像が取得できるエンドポイント
  }
    Logger.log("以下のURLから、画像を取得します: " + imageEndPoint)
    console.log(imageEndPoint)

    //画像のエンドポイントから、バイナリ形式でデータを取得
    imageBlob = getImageBlobByImageUrl(imageEndPoint);
    saveImageBlobAsPng(imageBlob)

    //画像データから、女優名(name)、合致度(confidence)、プロフィール画像(profileImageUrl), 女優の商品画像リスト(itemsInfoUrl)を取得します
    var faceId = detectFaceId(imageBlob)
    var personIdAndConfidence = getPersonIdAndConfidence(faceId)
    var personId = personIdAndConfidence["personId"]
    var confidence = personIdAndConfidence["confidence"]
    var name = getActressName(personId)
    var profileImageUrlAndItemsInfoUrl = getProfileImageUrlAndItemsInfoUrl(name)
    var profileImageUrl = profileImageUrlAndItemsInfoUrl["profileImageUrl"]
    var itemsInfoUrl = profileImageUrlAndItemsInfoUrl["itemsInfoUrl"]
    //LineにAV女優名・一致度・女優の画像・女優のAVリストを送信します
    sendLine(name, confidence, profileImageUrl, itemsInfoUrl)

}

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


function getPersonIdAndConfidence(faceId){

  /*
  * faceIdから、personIdとconfidenceを取得します
  * @params
    - faceId{String}: 画像から検出されたfaceId
  * @return
    - personIdAndoConfidence{array}
      - personId
      - concidence
  */

  end_point = FACE_API_BASE_END_POINT + "identify"

  try{
      faceIds = [faceId] //faceIdsはリストで送信される
      payload = {
        "faceIds" :faceIds,
        "personGroupId" :FACE_API_PERSON_GROUP,
      }

      res = UrlFetchApp.fetch(
        end_point,
        {
          'method': 'POST',
          'headers': headers,
          'payload': JSON.stringify(payload)
          //'payload': payload
        }
      );

      res = JSON.parse(res)

      var personId = res[0]["candidates"][0]["personId"]
      var confidence = res[0]["candidates"][0]["confidence"]
      Logger.log("personIdを取得しました: " + personId )
      Logger.log("coincidenceを取得しました: " + confidence)

      personIdAndConfidence = {
        "personId": personId,
        "confidence": confidence
      }
      return personIdAndConfidence;
    } catch (e){
      Logger.log("personId・confidenceの取得に失敗しました")
      Logger.log(e)
      return e
  }
}

function getActressName(personId){


  /*
   * Face APIから取得したpersonIdから、女優名を取得します
   * @ param
   *  - personId: Face APIで学習したpersonに紐づけられたID
   * @ return
   *  - name{string}: 女優名をフルネームで返します
  */

  end_point = FACE_API_BASE_END_POINT + "persongroups/" + FACE_API_PERSON_GROUP + "/persons/" + personId

  try {
    res = UrlFetchApp.fetch(
      end_point,
      {
        'method': 'GET',
        'headers': headers
      }
    );
    res = JSON.parse(res)
    name = res["name"] //女優名
    Logger.log("女優名を取得しました: " + name)
    return name;
  } catch (e){
    Logger.log("女優名を取得できませんでした")
    Logger.log(e)
    return e
  }
}


function getProfileImageUrlAndItemsInfoUrl(name){

  /*
  * AV女優名(name)から、DMMのAPIをかませて、女優の詳細データを取得します
  @param
    - name{String}: 女優名
  @return
    - actressInfo{array}:AV女優の以下の情報を取得
      - profileImageUrl{String}: 女優のプロフィール画像
      - itemsInfoUrl{String}: 女優が出演しているAVリストのURL
  */

  /* DMM APIから、女優名をもとに、サンプル動画のURLを取得
  */

  try {

    var encoded_query = encodeURI(name); //パーセントエンコーディングを行う
    var DMM_end_point = "https://api.dmm.com/affiliate/v3/ActressSearch?"
       + "api_id=" + DMM_API_ID
       + "&affiliate_id=" + DMM_AFFILIATE_ID
       + "&keyword=" + encoded_query
       + "&output=json"
    var response = UrlFetchApp.fetch(DMM_end_point)
    var txt = response.getContentText();
    var json = JSON.parse(txt);
    var actress = json.result.actress[0]
    var profileImageUrl = actress.imageURL.large
    Logger.log("プロフィール画像を取得しました： " + profileImageUrl)
    var itemsInfoUrl = actress.listURL.digital
    Logger.log("女優情報詳細ページURLを取得しました： " + itemsInfoUrl)
    var profileImageUrlAndItemsInfoUrl = {
      "profileImageUrl":profileImageUrl,
      "itemsInfoUrl": itemsInfoUrl
    }
    return profileImageUrlAndItemsInfoUrl;
  } catch (e){
    Logger.log("プロフィール写真と、女優情報詳細ページURLが取得できませんでした")
    return e
  }
}

function getImageBlobByImageUrl(url){

  /* LineのメッセージIDから、送られた画像をBlob形式で取得します、
   * @params
    - url{string}: 取得したい画像のURLです
   * @return
   * - imageBlob<string>: Blob形式で取得した画像ファイル
  */

  try {
    var res = UrlFetchApp.fetch(url, {
      'headers': {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN,
      },
      'method': 'get'
    });

    /*
    var contentType = 'image/png'
    var imageBlob = res.getBlob().getAs(contentType)
    Logger.log("imageBlobの取得に成功しました")
    return imageBlob;
    */

    var binaryData = res.getContent()
    var imageBlob = Utilities.newBlob(binaryData, 'image/png', 'MyImageName');
    return imageBlob
  } catch(e) {
    Logger.log("バイナリ形式の画像取得に失敗しました")
    Logger.log("エラーメッセージ：" + e)
    return e
  }
}

function sendLine(name, coincidence, actressImageUrl, actressInfoUrl){

  var messages = [{
    "type": "template",
    "altText": "それな",
    "template": {
      "type": "buttons",
      "thumbnailImageUrl": actressImageUrl,
      "title": name,
      "text": "一致度： " + (coincidence * 100) + "%",
      "actions": [
        {
          "type": "uri",
          "label": name + "の動画一覧ページに移動する",
          "uri": actressInfoUrl
        }
      ]
    }
  }];

  UrlFetchApp.fetch(LINE_END_POINT, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': reply_token,
      'messages': messages,
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}


function saveImageBlobAsPng(imageBlob){

  /*
    @params
      - imageBlob
    @void
      - Google Drive上の指定されたフォルダに画像を保存します
  */
  try{
    var destination = DriveApp.getFolderById(GOOGLE_DRIVE_FOLDER_ID);
    destination.createFile(imageBlob);
    Logger.log("[INFO] Google Driveに画像が保存されました")
  } catch (e){
    Logger.log("[ERROE]Google Driveに画像を保存できませんでした")
    Logger.log(e)
  }
}

//@depreciated
function getImageUrl(imageBlob){

  /*
   * GyasoにImageBlobを投げて、その画像のURLを取得する
   * @params
   * - imageBlob {Blob}:
   * @return
   * - imageUrl {string}:
  */

  GYASO_END_POINT = "https://upload.gyazo.com/api/upload"

  try{
    var res = UrlFetchApp.fetch(GYASO_END_POINT, {
      'method': 'post',
      'payload': JSON.stringify({
        'access_token': GYASO_ACCESS_TOKEN,
        'imagedata': imageBlob
      }),
    });
    res = JSON.parse(res)
    Logger.log(res)
  } catch (e){
    Logger.log(e)
  }

}
