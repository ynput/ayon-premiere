Premiere Addon
===============

Integration with Adobe Premiere.

Supports workfile management, eg. opening existing, publishing new ones.

Supports usage of file Loader, which allows loading AYON controlled assets like movies, image sequences, audio files, etc.
Supports management of loaded items, eg. updates.

Installation
============

Manually install `ayon-premiere/client/ayon_premiere/api/extension.zxp` via Anastasiy (https://install.anastasiy.com/index.html) or ExmanCmd
(installs into `Program Files` - requires admin permissions) OR
enable `client/ayon_premiere/hooks/pre_launch_install_ayon_extension.py` hook (installs into `AppData`)


## Developing

### Extension
When developing the extension you can load it [unsigned](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_9.x/Documentation/CEP%209.0%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions).

When signing the extension you can use this [guide](https://github.com/Adobe-CEP/Getting-Started-guides/tree/master/Package%20Distribute%20Install#package-distribute-install-guide).

```
ZXPSignCmd -selfSignedCert NA NA Ayon ayon-premiere Ayon extension.p12
ZXPSignCmd -sign {path to ayon-premiere}\client\ayon-premiere\api\extension {path to ayon-premiere}\client\ayon-premiere\api\extension.zxp extension.p12 ayon
```

Any change to extension should also contain bump of `ExtensionBundleVersion` in `ayon_premiere/api/extension/CSXS/manifest.xml`.

For easier debugging of Javascript:
https://community.adobe.com/t5/download-install/adobe-extension-debuger-problem/td-p/10911704?page=1
Add --enable-blink-features=ShadowDOMV0,CustomElementsV0 when starting Chrome
then localhost:8078 (port set in `ayon-premiere}\client\ayon-premiere\api\.debug`)

Or use Visual Studio Code https://medium.com/adobetech/extendscript-debugger-for-visual-studio-code-public-release-a2ff6161fa01

Or install CEF client from https://github.com/Adobe-CEP/CEP-Resources/tree/master/CEP_9.x

## Resources
  - https://ppro-scripting.docsforadobe.dev/
  - https://github.com/Adobe-CEP/Getting-Started-guides
  - https://github.com/Adobe-CEP/CEP-Resources
