# TEZUKA Mobile App

React Nativeで構築された縦スクロール漫画プラットフォーム「TEZUKA」のモバイルアプリ

## 🎯 実装済み機能

### 認証
- ✅ ユーザー登録
- ✅ ログイン
- ✅ JWT認証
- ✅ 自動ログイン

### コア機能
- ✅ フィード（おすすめ、フォロー中、トレンド）
- ✅ 投稿作成（縦スクロール・画像）
- ✅ 投稿詳細表示
- ✅ いいね・コメント
- ✅ プロフィール表示
- ✅ フォロー/アンフォロー
- ✅ シリーズ表示

## 📋 必要な環境

- Node.js 18.x以上
- Expo CLI
- iOS Simulator / Android Emulator
- バックエンドAPI（起動済み）

## 🛠 セットアップ

### 1. 依存関係のインストール

```bash
cd tezuka-app
npm install
```

### 2. バックエンドAPIの起動

```bash
# 別のターミナルで
cd tezuka-backend
npm run dev
```

### 3. アプリの起動

```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## 📱 画面構成

### 認証画面
- **LoginScreen** - ログイン
- **RegisterScreen** - ユーザー登録

### メイン画面（タブナビゲーション）
- **HomeScreen** - フィード（おすすめ、フォロー中、トレンド）
- **PostCreateScreen** - 投稿作成
- **ProfileScreen** - プロフィール

### 詳細画面（スタックナビゲーション）
- **PostDetailScreen** - 投稿詳細・コメント
- **SeriesScreen** - シリーズ一覧

## 🔧 API接続設定

`src/api/client.js`のAPI_BASE_URLを環境に合わせて変更：

```javascript
const API_BASE_URL = 'http://localhost:3000/api/v1'; // 開発環境
// const API_BASE_URL = 'https://api.tezuka.app/api/v1'; // 本番環境
```

## 📂 プロジェクト構造

```
tezuka-app/
├── App.js                    # メインアプリ・ナビゲーション
├── src/
│   ├── api/
│   │   └── client.js         # API接続
│   ├── context/
│   │   └── AuthContext.js    # 認証状態管理
│   └── screens/
│       ├── LoginScreen.js
│       ├── RegisterScreen.js
│       ├── HomeScreen.js
│       ├── ProfileScreen.js
│       ├── PostCreateScreen.js
│       ├── PostDetailScreen.js
│       └── SeriesScreen.js
├── package.json
└── app.json
```

## 🚀 今後の実装予定

### Phase 2
- 投げ銭機能（Stripe連携）
- アフィリエイト商品表示
- 案件マッチング画面
- 収益ダッシュボード

### Phase 3
- プッシュ通知
- 一気見機能
- オフライン対応
- ダークモード

## 🧪 テスト

```bash
npm test
```

## 📦 ビルド

```bash
# iOS
expo build:ios

# Android
expo build:android
```

## 📝 注意事項

- 画像アップロードはExpo Image Pickerを使用
- ナビゲーションはReact Navigationを使用
- 状態管理はReact Context APIを使用
- iOS/Androidのパーミッション設定が必要（カメラ、写真ライブラリ）

## 🤝 バックエンドとの連携

このアプリは`tezuka-backend`と連携して動作します。
バックエンドが起動していることを確認してください。

## 📮 サポート

support@tezuka.app
