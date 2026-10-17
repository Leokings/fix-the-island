# Fix the Island — StudioNet v4 deployment

Network: GenLayer StudioNet (`https://studio.genlayer.com/api`, chain ID
`61999`). This is a hosted development network, not Bradbury and not the
Studio-next/Studio-dev release-candidate preview.

Deployer: `0x797d3b25fb2cca0ff93f60df1910267f3822d655` (existing CLI account).
No key was exported or added to the repository. The balance was `0.792 GEN`
before and after all 16 transactions; the recorded balance decrease was zero.

All eight v4 deployments and all eight `configure_dependents` calls finalized
successfully. The independent read-only verifier checked each deployed source
and bindings against the manifest, execution result, finality, constructor
dependencies, and initial progress at `2026-10-16T09:12:25.992Z`. Full evidence
is in [`artifacts/deployment/v4-studionet/`](../artifacts/deployment/v4-studionet/),
including the committed machine-readable proof manifest
[`site-set-verification.json`](../artifacts/deployment/v4-studionet/site-set-verification.json).
Full per-transaction CLI receipts are retained locally in the same directory.

| Site | Contract address | Deployment transaction | `configure_dependents` transaction | Source SHA-256 |
| --- | --- | --- | --- | --- |
| Pier hoist | `0x0840A940861876b3230131F2342e2152Dd037764` | `0xe8994850922d535b3a5ae98463b8fe09de8c91e5b898d2198edc4274a21ab916` | `0x82e10e06c6543b02326095f9d7dfcbce820d93f0922523697eeafe52a54e3d26` | `0x88a2d4fc92ed1c59fa917a102b42f3f1fc34ff0a21e1ee3c088c83ccd6e46a06` |
| Village pump | `0xDFb8C78746eF99235c550692E5de3fAC85a89305` | `0xdad4f6b3f3523d8092c5d0e741cc248a8ca79f5edf3ba29a74b6b5ae7fd0608d` | `0xe6673e6adf4c1432ee4289100cb032a6e218c9d05eadff53546df1550c1fb0a3` | `0xf03e325a3b23f952b0293cb1ffcd75e090638c4dca309f631a64b4ea3c07b1fd` |
| Tidal sluice | `0xEb9cB49fe62bBBbB266bc1a43250aa14B574D98A` | `0xfbf33f6b8eef12e120b42e065ba6ecaf061f8e39b922b9fa4bfae5d31ee10f86` | `0x7a00da80a770833ebcd8371a7d9d2fddaa1a2656674ae89d1df28d80e3f5d8f4` | `0xd3ab2302167d4b37fc641114c1128d07e854690e533bfeb9116a1a090f2511eb` |
| Creek bridge | `0x3c9A076e1EbEa11CAb8C7083eeA211195814EC14` | `0x3b9c33c6aa8698cddfcb08c94289ab12900121e3cff8b8326399a27ff8d3518d` | `0x7bb4121ee639402e73292904a932ddbbfaea63a392e33af8bad21ea8f0cdcf3f` | `0x4cc32eb05bd1d636a932fd4c73b41fb7a046bc8ae0dfc73e58206ba1dd84c2a7` |
| Coast windmill | `0x48e28F7e653D54b1c56af07b92785f9d0f1c421F` | `0xadbe5cda3a0ed82485b2a9d15534cfe918836eb4f9f03bca78672aaaf51bafea` | `0x01b13d79e1b71fd817139b8c32ed5aabb9924625fc73c2c078f4129d4a2f15ef` | `0x63d7aba0d356d706bb71eb1148ec0feefc5c4ba6d628124ee87f78d1626d80fd` |
| Woodland pathlight | `0x0504139B936025E1Ad98CF3a51207cF40Efc7a58` | `0x6ab339158ad9e64fe9598aa031ff7fd59f84419e7cbf0bf98bdff100d982f60a` | `0x3d24f77527335429e58d2e7f08ae639035d58551c1582f4f60bc3758bbe18edd` | `0x3761cd1ef213b398fe5f7ee8a97f43cd6e8b9e3dcba5d6e571c23c4da7bb64c9` |
| Upland waterworks | `0xB78Fd9c82F5AA4d5F9810f73f1380e574C6A8680` | `0x84e75c30e03f48de5e50e1298680b4d0ab80a51c08bfb4d034b5ca50c65dd768` | `0x73c49b3296665db1ede9e5f996addd4fc4215470e515bc89e5537203a163c05b` | `0xdbb2ce183aa45370c7662be2ebd0c8fe71519917b7299b097472e9c18983671e` |
| Ridge beacon | `0x219B7Ab617355FAe1f2a7232B9CbE78e146697Bb` | `0xe9de07107e6c083526fc57181c7ec554b32736b4cb0766c2e5d69230be9515ec` | `0xf35c35e5687e4da971cc3a54c7dffaefd3bd11d13a4fdf7fdca247235628c76a` | `0x0c02787f0d3fb4f2f16dab94be52407811526b530fae958169f92a8c3c10a393` |

This verifies deployment and wiring, **not** a player's repair judgment. At
verification time, all sites had nonce `0` and no approved sites. The live
validator-review suite (one real review per site, including an empty-note pump
review) remains to be run. The address map in
[`src/genlayer/deployments.studionet.json`](../src/genlayer/deployments.studionet.json)
now points to v4. The public Vercel app has not been updated or redeployed.

## Historical v2 deployment

Network: GenLayer Studionet (`https://studio.genlayer.com/api`, chain ID `61999`).
This is a hosted development network with temporary state, not Bradbury and not
the Studio-next/Studio-dev release-candidate preview.

Deployer: existing CLI account `0x797d3b25fb2cca0ff93f60df1910267f3822d655`.
The account key was not exported or added to the repository. Current Studionet
preflight reported zero GEN deployment gas.

All eight v2 site contracts below reached `FINALIZED` with `MAJORITY_AGREE`; the
leader execution result was `SUCCESS`. The read-only verifier checked deployed
source hashes, protocol/site/version, constructor dependency addresses, schemas,
and initial progress. Full machine-readable evidence is in
[`artifacts/deployment/v2-studionet/site-set-verification.json`](../artifacts/deployment/v2-studionet/site-set-verification.json)
and the per-site reports in that directory.

| Site | Contract address | Deployment transaction | Source SHA-256 |
| --- | --- | --- | --- |
| Pier hoist | `0xff6813E38429cE47DCE102D764a527209DcC644B` | `0x6295017ce79811d122ec16cc8f4eff1720f7953721583c468670c048a87b03fd` | `0x946790bf019ebded702a9b8b8d01bebd3040424314a37007753532e088fa7767` |
| Village pump | `0x7aD8E4Afd29A2A768dA19e2cb57930287C15a2A9` | `0xe70a019dee457d8c0e0724405c628d71160acc4ddda39639769631768c2b5c5d` | `0x95836adfbe992802da6904ffd9000a9038bc5d332880f76c0cfac45d28e4cb1c` |
| Tidal sluice | `0x036B09b726B41195EE07f13D9A16F1f600394629` | `0xf26edde03908640e920453b9473dfffc53de54c701a0a8f28da71849aad2cb2c` | `0x24103df33e867be95240b88e0ed106036c7ec27ff06ff30a15e8ed38bd242fb4` |
| Creek bridge | `0x904EE30069960246c948a037e978567E6F2F7bd2` | `0x0dec9a96b5e96c84da0cdf19dd5dd34fd84406674c7bde28f64595a249a69e80` | `0x241d7912086c381dcd809956455e35b227ef0efd6ae157a0ce7fed043de1cde9` |
| Coast windmill | `0x39ED63a89ecd872F8B39a33363C0934355AF48ee` | `0xe4c6e726f14efa06528b2161d8c41f4bfa25c26699aa28b5028bdb377089eecd` | `0x69b2d0e691e19e5e9c44cadcdf80904a2c4e7b3687bced5747ef71f009355758` |
| Woodland pathlight | `0xC81B5f083e1ca7c370c3B8485847E76D1222de91` | `0x0ba7940ca504565206e94eb52dd91bab424301585f1f915f0d1df353a5b59d33` | `0xdbc687ad70f4f0f73b3868d041feef05898407c4011ca883774df7f28f966145` |
| Upland waterworks | `0xDB15ac3E7f341572383361fe8825c94842c5a9A3` | `0x22e3fa6e200b8016c5dc8973bdf7197c12942f5f4ae00e797183fb3f260b13f0` | `0x8759c04096e7128e89473c9cec001641eb29268231bf681cebf4fe36e28c2963` |
| Ridge beacon | `0x901C3B395B9C7F8Dac17B52e6DdDd2553f6e4C69` | `0xe6fa8b96ef788eac801946de650ed09c730889cad002fe56ea3cf7e46ee88b54` | `0x7bddcc3945cfb49fd158e65924a2cf0e5a36114298a238d15d8b3caae444b682` |

The app code now selects Studionet by default and keeps the Bradbury profile
separate. The public Vercel app has not been redeployed from this working tree,
and the real injected-wallet repair submission/recovery flow has not yet been
tested. Contract deployment proves neither that full player flow nor an
individual repair judgment. The source changes are not committed yet; each
contract's hash above pins the exact deployed contract source.
