# filebrowser-sdk

Unofficial TypeScript SDK for [FileBrowser](https://filebrowser.org/) — the self-hosted web file manager.

Supports: **Auth · File Operations · Directory Listing · User Management · Share Links**

---

## Installation

```bash
npm install filebrowser-sdk
# or
yarn add filebrowser-sdk
# or
pnpm add filebrowser-sdk
```

---

## Quick Start

```ts
import { FileBrowserSDK } from 'filebrowser-sdk';

const sdk = await FileBrowserSDK.create({
  baseURL: 'https://files.example.com',
  username: 'admin',
  password: 'admin123',
});

// List root directory
const dir = await sdk.files.list('/');
console.log(dir.items);
```

That's it. The SDK handles login, token storage, and auto-relogin automatically.

---

## API Reference

### `FileBrowserSDK.create(config)`

Creates and initializes the SDK (logs in automatically).

```ts
const sdk = await FileBrowserSDK.create({
  baseURL: 'https://files.example.com', // your FileBrowser URL
  username: 'admin',
  password: 'yourpassword',
});
```

---

### `sdk.auth`

```ts
// Manual login (not needed if you use FileBrowserSDK.create)
const token = await sdk.auth.login('admin', 'password');

// Get current JWT token
const token = sdk.auth.getToken();

// Logout (clears stored token)
sdk.auth.logout();
```

---

### `sdk.files`

#### List directory

```ts
const root = await sdk.files.list('/');
console.log(root.items);        // FileItem[]
console.log(root.numDirs);      // number
console.log(root.numFiles);     // number

const sub = await sdk.files.list('/documents');
```

#### Upload file

```ts
import fs from 'fs';

// From Buffer
const buffer = fs.readFileSync('./report.pdf');
await sdk.files.upload('/documents/report.pdf', buffer);

// With override (overwrite if exists)
await sdk.files.upload('/documents/report.pdf', buffer, { override: true });

// From string content
await sdk.files.upload('/notes/hello.txt', 'Hello World!', { override: true });
```

#### Download file

```ts
// As Buffer
const buffer = await sdk.files.download('/documents/report.pdf');
fs.writeFileSync('./local-report.pdf', buffer);

// As stream (recommended for large files)
const stream = await sdk.files.downloadStream('/videos/movie.mp4');
stream.pipe(fs.createWriteStream('./movie.mp4'));
```

#### Delete file or directory

```ts
await sdk.files.delete('/documents/old-report.pdf');
await sdk.files.delete('/old-folder');
```

#### Move / Rename

```ts
await sdk.files.move('/documents/old-name.txt', {
  destination: '/documents/new-name.txt',
});

// Move to different folder
await sdk.files.move('/documents/file.txt', {
  destination: '/archive/file.txt',
  override: true,
});
```

#### Copy

```ts
await sdk.files.copy('/documents/template.docx', {
  destination: '/projects/report.docx',
});
```

#### Create directory

```ts
await sdk.files.mkdir('/new-folder');
await sdk.files.mkdir('/documents/2024/january');
```

---

### `sdk.users` (Admin only)

#### List all users

```ts
const users = await sdk.users.list();
console.log(users); // User[]
```

#### Get user by ID

```ts
const user = await sdk.users.get(1);
console.log(user.username);
```

#### Create user

```ts
const newUser = await sdk.users.create({
  username: 'john',
  password: 'secret123',
  scope: '.',
  locale: 'en',
  viewMode: 'list',
  singleClick: false,
  hideDotfiles: false,
  dateFormat: false,
  perm: {
    admin: false,
    execute: false,
    create: true,
    rename: true,
    modify: true,
    delete: true,
    share: true,
    download: true,
  },
  commands: [],
  sorting: { by: 'name', asc: true },
  rules: [],
});
```

#### Update user

```ts
// Only pass fields you want to change
await sdk.users.update(2, {
  password: 'newpassword',
  perm: {
    admin: false,
    execute: false,
    create: true,
    rename: false,
    modify: false,
    delete: false,
    share: false,
    download: true,
  },
});
```

#### Delete user

```ts
await sdk.users.delete(2);
```

---

### `sdk.shares`

#### List all shares

```ts
const shares = await sdk.shares.list();
console.log(shares); // Share[]
```

#### Create share link

```ts
// No expiry
const share = await sdk.shares.create({
  path: '/documents/report.pdf',
});

// Expires in 7 days
const share = await sdk.shares.create({
  path: '/documents/report.pdf',
  expires: '7',
  unit: 'days',
});

// Password protected
const share = await sdk.shares.create({
  path: '/documents/secret.pdf',
  password: 'mypassword',
  expires: '24',
  unit: 'hours',
});

// Get the public URL
const url = sdk.shares.shareURL(sdk.getBaseURL(), share.hash);
console.log(url); // https://files.example.com/share/abc123
```

#### Delete share

```ts
await sdk.shares.delete('abc123hash');
```

---

## Error Handling

```ts
import { FileBrowserSDK, FileBrowserError } from 'filebrowser-sdk';

try {
  const sdk = await FileBrowserSDK.create({
    baseURL: 'https://files.example.com',
    username: 'admin',
    password: 'wrongpassword',
  });
} catch (err) {
  if (err instanceof FileBrowserError) {
    console.error(`HTTP ${err.status}: ${err.message}`);
  }
}
```

---

## TypeScript Types

All types are exported and fully documented:

```ts
import type {
  FileBrowserConfig,
  FileItem,
  DirectoryListing,
  User,
  UserPermissions,
  Share,
  CreateSharePayload,
  UploadOptions,
  MoveOrCopyOptions,
} from 'filebrowser-sdk';
```

---

## Notes

- This is an **unofficial** SDK — FileBrowser does not have official API documentation.
- Auth uses the `X-Auth` header (not `Authorization: Bearer`).
- Token is automatically refreshed if a 401 is received mid-session.
- Tested against FileBrowser **v2.x** (`filebrowser/filebrowser`).

---

## License

MIT
