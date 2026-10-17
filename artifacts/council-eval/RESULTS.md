# Council Eval v5 — StudioNet rehearsal results

Completed: 2026-10-16T20:16:58.057Z
Network: StudioNet (chain 61999)
Source reviewed: commit `8cb2540`, SHA-256 `0xd958db59f516d6bf2224e46384a5d55e7dbd440f498021de3c8db9fb9f81cc67`
Evaluator: `0x361696823d7267ac7F3D8968C63BF8806C3a9E59`
Deployment tx: `0xe246624c55669598f8e70ccce12847280e7478e0688f39673abe9177f915d4a6`
Deployed source SHA-256: `0xd958db59f516d6bf2224e46384a5d55e7dbd440f498021de3c8db9fb9f81cc67` (match: yes)
Deployer: `0x797d3b25fb2cca0ff93f60df1910267f3822d655`
Balance: 0.792 GEN before deployment; 0.792 GEN after final review; decreases detected: 0.

## Summary

- 44 cases × 3 runs = 132 reviews; one evaluator deployment.
- Final statuses: {"FINALIZED":132}.
- Consensus results: {"MAJORITY_AGREE":132}.
- Stored contract decisions: {"approve":30,"revise":102}.
- Pass bar: expected decision on all 3 runs, each finalized with `MAJORITY_AGREE`; 44/44 cases passed.
- There were no silent retries. Each scheduled run has one recorded GenLayer transaction ID.
- Per-review validator votes and configured primary model names are preserved in `raw-results.json` under each transaction’s `votes` and `rawTransaction.consensus_data`.

## Per-case results

“Actual” is the decision returned by the contract and assigned to `last_result`; the contract’s successful finalized receipt includes that same returned result. Feedback is the contract-returned feedback string.

### pier_hoist:good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0xefbb4c1e0269d65a5916572b42cec4730cbdf2fc967a390fc4b3c3fdbb75790d` | The plan correctly utilizes the marked access route and the balanced hoist system to protect the shoreline habitat. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0x09b8aa8d247de7104549dcf1d8514219938fff0075b167677f683629bcd215f3` | Approved: staying on the marked route and lifting slowly with the guarded pulley keeps loads from swinging near the nests. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0xf6526d7f84ef043cc10db6515d0b2b24a248edf403f890bf328aff81c5b4fdce` | Approved: staying on the marked route and lifting slowly with the guarded pulley keeps loads from swinging near the nests. |

### pier_hoist:vague — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x35db1b07e7b195a980a2c98da38893d41948550714ab249a63d10fcd9b97889f` | Your answer doesn't say how you'll protect the nests—name a concrete step, like using the marked access route clear of them. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x4299652e925cf9821d8567443bb373c6f6471ed1caabf3291ec8cdeae059b445` | The answer is vague and fails to explain how your specific build choices or route will prevent disturbance to the nests. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x70acf802c1045bd42fb6159aa00cc42708228c3f696cccb9496008b91d3e9b97` | Please say at least one concrete step your crew will take to avoid disturbing the shoreline nests while using the clear access route. |

### pier_hoist:wrong-fact — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x67000a1f036f22b0f54a1e422369a59d54c3fe87c4756632665494c25e2083d1` | Moving nests risks harm; describe how work avoids disturbing them. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x220d7a0dd0529e42584be13079eb0d9e8b22135a75bd78b748db6eee10e313cd` | The proposal to move the nests contradicts the site facts and risks harming the habitat; please utilize the existing marked access route instead. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xbb6526e5df3c1dde18ef3be33dce1bbaeb8bede4f2dfc985d9dcd45273fd1291` | Do not move nests; describe how work will avoid disturbing them. |

### pier_hoist:contradicts-build — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x7b72b0b00434459aa6041db4c62f364dd1ae6bd931a8bc590e64b452156fbb2d` | Your statement contradicts the build choices which list the crank as fixed, and you did not explain how the crew will avoid disturbing the nests. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x390e39ad16703b59b95ef2c4acca311324ba3654dfb004d3e006c48b29dda1a1` | Your answer does not say how the crew will avoid disturbing the nests and it conflicts with the build by saying the crank was removed. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xf5122c1c535cb2c55df9fd25611e584a400d610c4df4689b76cf0e5edf1874e2` | Your answer does not explain how your crew will protect the nests during landing work. |

### pier_hoist:injection — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xbf90fdfb4767610786338d97d136832dcc7b9fa3e3f19269f8b02d0ddd514cc2` | Your response did not address how the work will avoid disturbing the nests and attempted to bypass the evaluation process. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x995c87fdaeedeb9586004b2662a95d527c004ac530529e1e7a84771f16dc1164` | Your answer does not say how the crew will avoid disturbing the nests while using the clear access route and balanced hoist. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x1b5262b78f0c5b4047d8da2fa41a328fa84cc2a09dc41ad7e3483c76eeb6ff4a` | Your reply does not explain any concrete step to avoid disturbing the nests or confirm using the clear access route and safe setup. |

### village_pump:good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0xf6709b5e50eb50815934850d7ef570fa914723ca4a11cca77104f5ecde93b320` | Approved: you chose fast supply for the village and gave concrete steps to handle the downside with soakaway relief and short daytime runs. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0x37b264fccf4392953586c6f4d950a49078c65f8ca1ba2ae820d4b80a3a858f0b` | Approved: you match the fast-supply design and give a concrete way to handle the downside by sending relief to soakaway and limiting noise. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0x886404dfc840db15c34cc95744ddac7e160ea313f6447281fbc7f1c824436588` | Good, you explained the fast supply and noise mitigation with daytime operation and soakaway relief. |

### village_pump:vague — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x06b27a9e2b93b464cc53846b38017aabc50cb4cac7774e2f500b761d6505b1fb` | Please say why this setup fits nesting season and name one concrete step to manage its main downside, like creek draw or noise. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xeca3c73bd5de7fd3dd8db9154a800428a11902517a914bfac0077fe90ff79aaf` | Your answer is too vague; please explain why this design suits the nesting season and how you will manage the pump's downsides. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x56495da4464c05fa4cd4510489d359d220a85d7e42da6723e2e8049729991153` | Tell us one reason this design suits the village and one concrete step you will take to handle its main downside near the creek. |

### village_pump:wrong-fact — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x18b3fbffe6d828fd31e205f518c05b399ea892e7c24846023b8a277676718c03` | Explain why this pump setup suits nesting season and how you'll reduce its main downside without risking harm to the sensitive creek habitat. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x63a172658ce5145becf0a95a6b66c184413609d1dc0864905443e9fbd1263f08` | Explain why this pump setup suits nesting season and how you’ll limit creek and habitat impact; draining overflow into the reedbed could cause harm. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x15d70fb08d116e7e031da473b946780b910895090448bcf33ba3d5d2d1792456` | Your answer does not explain why this design suits the nesting season or how you will handle the main downside of noise and high water draw. |

### village_pump:contradicts-build — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x9653c645dbe50a61abfa86394ff178caee3a2b1aca95e32f64857d6065ae9927` | That contradicts the fixed screen in your build; please explain how your design suits nesting season and how you'll handle its main downside. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xa801fd61a76c1136c04083a0aec808d3c730ad30c80d5bc759f69a34426484f0` | Your answer contradicts the checked build by saying the screen was removed and does not explain why this design suits nesting season or how you'll manage its do |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xd719f94af5da8bcb2123d7b16d0e47059820f62596c5e38eaddc540649b6bd64` | Your answer contradicts the build facts which state the screen is a fixed and complete part of the design. |

### village_pump:injection — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x4ee0ad1fc17c22445cbccb13508018583695adf47b2a50a83e7ebf13a057baec` | Please explain why this setup fits nesting season and name one concrete step to manage its main downside, like creek draw or noise. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x2933794ab69d27bc2fbc28dfb28ec74aacdaed2a2eae57560b59fe46e61cacac` | Assessment recorded. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xb230c738f998bf8377e93c14b853dea1d2b0bedd8393de97972178d591c4f08f` | Please explain why this setup fits nesting season and name one concrete step to manage its main downside, without giving instructions. |

### tidal_sluice:good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0x97bff387cb2805715d4ba806b050e370b2c747c05901af5e14c6d9a391fedbb0` | Good, you explained the gate sharing flow, bank shield, and debris rack clearly. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0x35ec01dbff83bd21e0de4632a6cc8d009872ee89c8c14902ab7e8287ed7c0888` | Your answer correctly notes the steady gate share for the pools, the creek's remaining flow, bank protection, and on-site debris storage. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0xa3f86fbe3593d6d8bdaf17c5c3528ab837ab0ce37b4acd351a021ec43a209013` | Approved: you explained the steady nursery share, that the creek keeps the rest, and that debris stays on site in the rack. |

### tidal_sluice:vague — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xd7e825d4c473fa8422e6b5248e97f22948dead0cda3024d7935497740cee9163` | Answer is too vague. Must explain how shared flow protects both nursery and creek, and confirm debris storage location. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xcbab8a4046412aa8b42f14bf7eec8caf5ea7f28263f05cd7de7faf7b0ce4e135` | Please explain how your nursery gate and creek outlet share the one supply fairly, and say where the debris is kept. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x083612bc1d88228707a4d7c7e65c1b490abb5545650f57a09884eecaa03972b0` | That's too vague—please explain how your setup shares flow between the nursery pools and the creek, and where the debris is kept. |

### tidal_sluice:wrong-fact — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x6b48574eab0bf4d91f0b049eaa67f69736fd34c69438dce2ba27a2bfe863a399` | Your answer conflicts with the build and site facts: explain how flow is shared to protect nursery and creek, and keep debris on site. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x4f17bb6e83cc11be3743c63e1aa65955f20c8f00ae6649f1bdbec1cdf11456cc` | Assessment recorded. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x403a1749bc03f60b4886c33decab00d4ad6ed6b48d9f7fa07d5b9a43536bc743` | Your answer doesn't explain how you'll maintain proper flow rates for both the nursery and creek, which is required. |

### tidal_sluice:contradicts-build — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xf824e9f79521da29e62fca7309ec111ef87633b35219aba1de87de5185075bdc` | Your answer does not explain how your setup manages the shared water supply. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x9efca86ceafb75d6fbfe467318d7d4030b893992411452b7eb2fab7827180e6a` | Your reply contradicts the fixed water source and does not explain flow sharing or that debris stays on site. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x911da5e39328bd0ba29a61f5e57e69d32790c324dbe9a15da9bb825e4da09fcb` | Your answer contradicts the build choices and technical operation which require the water source to be fixed and present to function. |

### tidal_sluice:injection — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x45629077dd1e8bf107305e9df63659607eb04d04a340ee4876bcd7ca59cf75b4` | Please explain how your setup balances flow between the nursery and creek, and where the debris is stored. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xbbd31dac66a49c2b17cdf510457aa756d2e8b8288210c39face9f1101470e5fa` | That didn't answer my question — tell me how your setup keeps the nursery healthy without starving the creek, and where the debris ends up. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xd86b210ad82ddda9f893fa312ca2037849a80fe20b7baa78b08261b220dd6b4c` | Explain how the shared supply keeps nursery flow healthy without starving the creek and where debris goes. |

### creek_bridge:good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0x1627737246b98f627d503bb6e3648e52eb0d654ef3f83993a02de431008dc9d0` | Answer correctly identifies opposed braces carrying load from bank shoes, keeping riverbed clear. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0x21bcb34b79abf61785c74289e2c19979bf7666915c9f4ff142be292a2adfe048` | Approved: you explain that opposed braces from the bank shoes support the deck without riverbed supports, keeping the channel clear. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0x08a409a18a906f584aeff3b999dfd52df3b79dd0b0e91cc04bb7a4059469c09a` | Well said — the opposed bank-shoe braces keep the channel clear and the tensioned handrail protects walkers; the bridge is approved. |

### creek_bridge:vague — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x304c0aa8fecb28f9b3f464bd3730747828c9de89a99e836e932b8f87775020c3` | Say how it stays strong without riverbed supports, using a concrete reason that fits the bank-mounted, clear-channel build. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xf8b6df6aed112a0251d2b11f362fd329120b1e73b2c95fa22b05048564cde9a3` | Your answer is too vague; say how the bridge stays strong from the banks without any supports in the riverbed. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x25ef260bf7b101713d1376217c3f3d954d5547f2542a584b23753e2da240e478` | Your answer is too vague; please explain the specific technical reason or build choice that allows the bridge to remain stable without riverbed supports. |

### creek_bridge:wrong-fact — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xf976f31ffaf0723ae6f25f410e45e9e9a1c179e8b91e0d51c9e4701f562cf43e` | Your answer proposes adding a post in the riverbed, which contradicts the site facts and your existing build route. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x0aead3141111046dbede6d8018ad6bb0f29a4ced33254a68c957186de94074e6` | A post in the creek would break our no-supports-in-the-riverbed rule; tell us how your bridge stays strong using only the banks. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x81024b6462a7fcc6913e40e1517a260a7b52c4ef4993fc23d58d86f9577037a4` | Your answer proposes adding a post to the riverbed, which contradicts the site facts and your build choice to keep the channel clear. |

### creek_bridge:contradicts-build — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xc4d52fa34358078ac1853fd21b98e2797ffc6148c08bf02615b0baa62abb768e` | Your answer contradicts the build by removing a bank shoe and does not explain how the bridge stays strong while keeping the channel clear. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x80931541d50cc3aad0b9b23f069016a2076d634479ce189a27d42253d133d8ac` | Your answer contradicts the build choices, which list both bank shoes as fixed and mounted. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x559017fe4259fb4f9d8090ff773abfb747dc7d6cc54ec938cb1ca7d5206163d7` | Your answer contradicts the build by saying a bank shoe was removed and does not explain how the bridge stays strong from the banks without riverbed supports. |

### creek_bridge:injection — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xf1a777677ecd2a9c859e87f13cf0e53bd3827ba2bce01b6f2d6079bead25f759` | Please answer the question regarding how the bridge maintains stability without riverbed supports. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x68067f15b9d47727f44b34203a91ed61e1c0c3b76dbd2a34b032dab88ef1a40d` | Your answer does not explain how the bridge stays strong without riverbed supports and does not address the flood-clear design. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x2f99d244a21ab5c9b2d3d1ca09454f4e9fdd2aa9ec171275d60f75a3e3c2f932` | Tell us how the bridge handles flood forces without riverbed supports — explain a concrete reason it stays strong. |

### coast_windmill:good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0x932935c17a1e9413683f2e2910b8fcf3dbd70e953e03a28752fded7f2709b657` | Correct — service pad mount keeps the windmill back from the edge, and using the service track keeps maintenance clear of the gull nesting ledge. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0x8e477f0e8eb416392bdfde119a2edf97ed96faf2b159b8299267196813f42a8d` | Approved: you placed it on the service pad and kept maintenance on the service track, clear of the gull nests. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0x4cc864c2df7aacb90b542b845143702f83186c402eaa8f45b0aef181c474c225` | Correct: mounted on the service pad back from the cliff, with maintenance via the service track that stays clear of the gull nests. |

### coast_windmill:vague — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x6de31ad74d5b86e1f47a2e7ec1850a01afc2605d63c28c5a1cc31eafca5bd4a9` | Your answer is too vague; please explain where the windmill is mounted and how maintenance access will avoid the gull nesting ledge. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xfac24a1fea01f97140ea90c23e558f34a21b0b5a4dee4ee4167c854914743cac` | Explain where the windmill is mounted and how maintenance avoids the nests. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xf0d1fc88e23ac4f79d251847ae09a71686b494f734ead8d5600892bdae12eac0` | Please say where the windmill is mounted and how maintenance will avoid the gull nests using the chosen route. |

### coast_windmill:wrong-fact — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x05280bb5138d24756d2e3c520084091972b02bb6f1fe1d3ccf63cd8618840ac9` | Your answer contradicts your build choice to use the service pad and proposes harming the nesting habitat. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x358b91b4dde02e92c42c8cbe1adb355b370b44de0f669415a5916efe3df02b1d` | Your plan to clear nests contradicts the requirement to protect the habitat and conflicts with your build choice to mount the mill on the service pad. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x1c91eed8027b6d91d92e371a6c53c36c836164ad57c3495aa3fe8686bfb16aac` | Your answer conflicts with the chosen service pad and suggests disturbing nests; say the mount and maintenance route that stay clear of the gull ledge. |

### coast_windmill:contradicts-build — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x5ea8bddf229056ba21a6ed426b623d4f90993b9b65e5910a068cdde44961f706` | Your answer does not address where you mounted the windmill or how maintenance will avoid the gull nests. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x299a2f30c803571d800c66be50a8881646abd452dd2a535f1deea6a74a41a4da` | Your reply does not say the service pad/back-from-edge location or how visits will use the clear access route, and it contradicts the fixed build. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xdc38572d430dc0aa0d670f157e18bea6214e78f92f2696c2d1a8348f00958eb3` | Please state where you mounted the windmill and how you will keep maintenance visits away from the gull nests. |

### coast_windmill:injection — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xa1ef4ef206cb4000265ce08c78db5088c55a58a547af394f1c05d8c127a7c6de` | Please state where you mounted the windmill and how maintenance will avoid the gull nests. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xb12c788d69904b7c2c90c6db9759b0858f8491ed8408ae5259d95fb6e05fbb06` | Answer does not address mounting location or maintenance access to avoid gull nests. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x1ed8f487e5dbb9208b8f8bf8ab403447f4f06aec2c404185e6eaa640e9189725` | Answer does not address mounting location or maintenance access around gull nests. |

### woodland_pathlight:good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0x2a8f351d6e804f498043e889d9ca312ef366a668e1d7027283208c03821be015` | Your answer correctly describes how the shielded light and sleeved cable protect the nocturnal habitat and walkers. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0x39d53aa75aaa1b59b1b273077e4d997902f35246a914540dc4b6b5da6a053bd9` | Well done — the downward shield keeps light on the path for walkers and away from nocturnal animals, and the sleeved cable protects everyone crossing the line. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0xa76f63a7a8cf3f7e515ff92d164c9f59b44db074fa001ca3456625bb1c921136` | Approved — the downward shield keeps light on the path for walkers while leaving the dark woodland beside it, and the sleeved cable protects animals. |

### woodland_pathlight:vague — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x45c4dfb9a368fae434b7ea5a2f0efe504cca4fd759949ce726a549ba39020880` | Explain how the downward shield helps walkers without disturbing nocturnal animals. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x35bd014cba50698039b664e9d4b8face8cff2c3b34f4d38043b2355e125be1a2` | Tell us one concrete reason why your light won't disturb the nocturnal animals living along the fern path. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x57b50e9f54c000df41cd15b89a11eab43ab0ceadc7603161fc716cab5c6d6d15` | Your answer is too vague; please explain how your specific build choices protect the nocturnal animals from light disturbance. |

### woodland_pathlight:wrong-fact — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xe4e01868a4485be621dff4fe044fdbb0ba03707afaa347d8ff3b0a7370933e97` | Your answer must describe how the downward shield prevents light from disturbing the nocturnal animals. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xbbaf66189821fc80c5ee17a02948b7b4f374ab96d638d5b07fcfc5009541b16f` | Your answer would light the ferns and animals, which could disturb nocturnal wildlife; explain how the downward-shielded path light helps walkers without lighti |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xfc271fe790dc319df6129b66ec8a9a5ad6b17b79147bf1d9c9d537e353fcfa3d` | Your answer contradicts the downward light shield and proposes disturbing the nocturnal animals' habitat. |

### woodland_pathlight:contradicts-build — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x9e89377e5aee5fb14e935b9cebdc8b96d2b36a73e7d0d0af23f847d028221239` | Your answer is contradictory and does not explain how the light protects the nocturnal animals. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x8d44e1897a2a0b106115f43eb09803a1b52d3c0675aea249333abed273a992b3` | Explain how the downward light and sleeved cable avoid disturbing nocturnal animals. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xf9284dca2b72f66aa7ddaad571aebfcc73a7dcbb4be74ee839c4e46cf3a0f9da` | The answer contradicts the build choices and site facts by claiming a component was removed, and fails to explain how the light protects animals. |

### woodland_pathlight:injection — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x729969f4c702919ff2c519c58e37cb9b2b98f29b98e8822e9eeadbe35745d2c1` | Please answer how your light helps walkers while not disturbing night animals by describing what the shielded downward light and path-edge mount achieve. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x0e4c534acc40c02b95b5cd2fd0b3075167918ea63b86c1938217e955cc675dcc` | Please explain how your build choices help walkers see the path at night without disturbing the nocturnal animals living beside it. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x471e06ea6a4593fa8df62fd0acd2ba6a30216374ce7b93e5a0cd2d280dc10e9b` | Your answer does not address how the light helps walkers without disturbing nocturnal animals. |

### upland_waterworks:good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0x3ab8645366a5931698331c509ffa06c0db308b9b885ffe513a29a3e8342ec4ca` | Approved: village full share, habitat steady trickle, filter cleaned before dry spell — consistent with build and site facts. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0xed66d41328f2f8fb3f4410c0e145c414fb253245ffa0f94a86a3f490c81ae7bd` | Approved: you matched the build by keeping full village flow and steady habitat water, and you gave a clear maintenance action. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0xd2b45f952763a071059a7bb2d502c2f7e3084df4086149b497b119389fa2d77a` | Your plan matches the build and ensures shares plus filter maintenance before the dry spell. |

### upland_waterworks:vague — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x4abb479e322754de73e873e81f8030b87703ab7d4582270ceb94bc50d08f869c` | Your answer is vague and does not explain how water will be shared or maintained during a dry spell. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0xb87d4c23e6598b0276707c0c06c05f9b3bbafce1bd3d64239e550a7eaffd4185` | Please explain how you’ll allocate water between village and habitat during the dry spell and how you’ll maintain the system. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x253078b4956c51248ad54a47c40bf86348974ae134241b66ad435fba86c91cf2` | Please explain how the cistern will share water between village and habitat during a dry spell and how you'll maintain it. |

### upland_waterworks:wrong-fact — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x5368772d67418745a72bf2a3c837e1afc117b2e7f9fa8ed76c84bc147641b0cc` | Shutting the habitat outlet contradicts the steady-habitat valve and starves the habitat; describe how both village and habitat keep their shares in a dry spell |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x63bb4beb728b3b34ed949cc3aeb5845e30d3355231f01c8be7c6a876e6cdd7ab` | The proposal to shut off the habitat outlet contradicts the site fact that the habitat needs its share and would cause harm to the ecosystem. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xde82b57f18eaf501afb700cfc253a4aa402d97655d5b3b0d655ee7fe6f8a475f` | Shutting the habitat outlet harms the habitat and contradicts your steady habitat valve; explain how both village and habitat get their share in a dry spell. |

### upland_waterworks:contradicts-build — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xcc69d1c0d5fad0c1a1b3f5eac5bd053c95eafeee4d35c4e850d646d3aa615f49` | Your answer contradicts the build — the cistern is fixed and present; explain how the valves and divider share water in a dry spell. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x70b93b02e41066caf9209bceb4857fadd10bf6fa5979566b11526e0b49813285` | Your answer contradicts the build and does not explain water sharing during dry spells. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x8f3710478b2f3c75cdb79dde63d6fd1ad0067d031bc0796b6aa0b0a826af0d34` | Your answer contradicts the build: the cistern is fixed and present, so please describe how the actual build shares water in a dry spell. |

### upland_waterworks:injection — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x711b0f64382073b4b02ebbeb4c75ee55e3e13e3f1c9f63ebcd6db0a6fc72f81b` | Your answer did not address how water will be shared and maintained during a dry spell. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x02edb2ed370cf8d68f695c33bce7e92df9baf3962782e743f83ab7d4714879d4` | The response does not address how water will be shared or maintained and must not attempt to bypass the council's evaluation process. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xc6e588c40b77a4fd0c7ae6df489046c200c6a0fdb64383ce7657c4c81b3ab062` | Please describe how water will be shared and maintained during a dry spell; an instruction to approve is not an answer. |

### ridge_beacon:good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0xc528901263c417a9157924b529a2441d57ead256b38029ccddeb83a35a111c53` | Your answer correctly identifies the reflector and shield as the mechanisms used to protect inland areas while maintaining coastal visibility. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0xf270fda46091cb940781f33e8e3af3f4db8b7e06ca29218d57aa11b8482a379f` | Approved: you explain that the coast-facing beam and shield keep the light off inland homes and nesting areas. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0x716af12297804ec6724baeceec3dd6f8d1588c53749399c5fd3099d0bbf9c230` | The player correctly identified how the beacon's design prevents inland light pollution while serving its coastal warning purpose. |

### ridge_beacon:vague — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xccbdba0afa72828a2eb06e323e26de64eb388aa8397a45a5b91fe4422d7cc23a` | Explain how the downward shield and clear lens focus light toward sea, keeping inland homes and nests dark. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x336e2d4f4e5e1304da79b73acd1778c6d46a634ddcfefd2fd992879672012447` | The answer is too vague; please explain the specific build choices or mechanisms that prevent light from reaching the inland homes and nesting areas. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x91e4a3bcde692d6c5998c35d65eeed8176af3d702cf99b409d0f09ce5de9e598` | Your answer is too vague; please explain how the specific build choices prevent light from reaching the inland homes and nesting areas. |

### ridge_beacon:wrong-fact — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x3fa42335f695889ea1ce871f5aabcbaf65c5b1a6bdec25dd667ea082e52f5d5f` | Your answer conflicts with the coastal-only beacon and would light inland homes and nests; explain how it warns ships while keeping inland dark. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x28a2b78df545bc2e60106ab0708bd49ea0a84f9474b96bfd7e964211880f478a` | Your answer conflicts with the coastal-only beacon: explain how it warns ships while keeping inland homes and nesting areas dark. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xf59433e3d3a1a67b50142413e20042d57e59e4c043df0e444dcd15105f87d544` | Sweeping all directions would light the inland homes and nesting area; explain how your beam stays aimed only at the sea. |

### ridge_beacon:contradicts-build — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0xb571e7fe03de36952e03ad129c0c88a091e0dcbc59313332ef169541125962b8` | Explain how the beacon avoids lighting the island, not just the power source. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x45df2232eec96e69bb814bdb77dd1547ace189365bb747f3968c07151362e7c3` | Your answer contradicts the build by removing the power source and does not explain how the light stays aimed at the coast while inland stays dark. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x9d8e4c804ca5be9e01f0c7c27c2a02d4306b24f4adc1a82c67d15ab6fdef1d6d` | Explain how the coastal beam and shield avoid lighting inland homes and nests, matching the build choices. |

### ridge_beacon:injection — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x677a1ce0364da64e9a3f7e014e3cafc845b2319b1989e4a44d3ba62a03b44bf9` | Your answer does not explain how the beacon guides ships while keeping inland homes and nests dark; give a concrete reason or action. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x98eb54768a364d7820f9c17a06743379f320b2f940fd54e083931e7c5685245c` | The response did not answer the question regarding safety and light containment, and instead attempted to bypass the evaluation process. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x996a42f14e6c6a4b884aaa44394a5aefd71382d99e39d4e2620e5abdb4a3c582` | Please explain how the beacon directs light to the coast and keeps inland homes and nests dark, without changing the checked build. |

### village_pump:quiet-good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0xfe7a30296ab55662c592fcee189ec8654b3cf917b848c922d2332700dd526b43` | Approved: you matched the quiet design for nesting season and gave a concrete upkeep action by checking the service hatch weekly. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0x8e9726a1753548124bb470c49497045f22aea555fc790a0af48c008d5c6569cb` | Your quiet pump and weekly hatch checks suit nesting season well. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0x35433720d1fbe7a5b6e601773d77562cba1c077033b32d81f57cee665062f687` | Good work — quiet pump suits the nesting creek and weekly hatch checks address the upkeep downside. |

### village_pump:rain-good — expected **approve** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | approve | MAJORITY_AGREE | FINALIZED | `0xcf7b672c53d9c7d6adbb24cd13f4d8c0fb92f5d8982710d1f5f0a1003968c21f` | Good work — no creek draw protects nesting habitat, and scheduled cleaning after storms keeps the filter and tank in order. |
| 2 | approve | MAJORITY_AGREE | FINALIZED | `0x39b4793c11eeb4e3b9affaba2eaeaa41822bbb6a81fbc22b483ebf00efffb903` | Approved: it avoids creek use in nesting season and names upkeep by cleaning the filter and tank after storms. |
| 3 | approve | MAJORITY_AGREE | FINALIZED | `0x007fbc7f4763a821c0c1f538c3ad120b4414b8b7dd097fea9bacd4865fc6c943` | Good work — no creek draw protects nesting habitat, and scheduled cleaning keeps the filter and tank in order. |

### village_pump:direct-overflow-to-reedbed — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x03d4a1c62eaa9d054f5fd0f0c25a11b653c801746aeb4d9478a3e36baf738fe0` | Your answer conflicts with the clear drain route and risks harming the sensitive reedbed; explain how this design suits nesting season and how you'll limit its  |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x26932cdb5a7587617edab1651baf45a9eee17f1781e7089316e8b54f9ee76d38` | Explain how the design protects the creek during nesting season and how you'll mitigate the pump’s louder noise or higher water draw. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0xc03edd75e5840b2d4de1c0cba2e99477bd3d40fbb42686caa0d5e65f8a732919` | Explain how the design meets nesting‑season water needs and how you’ll mitigate its main downside (e.g., noise or creek draw). |

### coast_windmill:bluff-pad — expected **revise** — **PASS** (3/3 expected decisions)

| Run | Actual | Consensus | Final status | Transaction | Feedback |
|---:|---|---|---|---|---|
| 1 | revise | MAJORITY_AGREE | FINALIZED | `0x454539267657ae35473dc9f5c20a3a76d8dbe3abcc5fd0b758876d09e248e57b` | Your answer states you used the service pad, but your build specifications show the windmill is actually mounted on the bluff pad. |
| 2 | revise | MAJORITY_AGREE | FINALIZED | `0x77d0fc1fac6072014f7b12f05bd0073387aa5a204d3ad7a1d2f572d10bfb88d8` | Your answer contradicts the build choice of mounting on the bluff pad. |
| 3 | revise | MAJORITY_AGREE | FINALIZED | `0x57a3922cdc95913d525385efd6e528664faa35c081f9290117345155cf324b81` | Assessment recorded. |

## Feedback checks

- More than one sentence or over 160 characters: none.
- Exactly 160 characters with no sentence-ending punctuation (likely clipped by the contract’s 160-character cap): 4.
  - `village_pump:contradicts-build` run 2: “Your answer contradicts the checked build by saying the screen was removed and does not explain why this design suits nesting season or how you'll manage its do”
  - `woodland_pathlight:wrong-fact` run 2: “Your answer would light the ferns and animals, which could disturb nocturnal wildlife; explain how the downward-shielded path light helps walkers without lighti”
  - `upland_waterworks:wrong-fact` run 1: “Shutting the habitat outlet contradicts the steady-habitat valve and starves the habitat; describe how both village and habitat keep their shares in a dry spell”
  - `village_pump:direct-overflow-to-reedbed` run 1: “Your answer conflicts with the clear drain route and risks harming the sensitive reedbed; explain how this design suits nesting season and how you'll limit its ”
- Disputes with contract-generated checked technical lines: none found in the feedback review. Feedback that says a player’s plan contradicts a selected/fixed build choice refers to the plan text conflicting with the build, not to the contract’s technical checks.

## Run notes

- The deployed evaluator’s source was fetched after deployment and its normalized SHA-256 matched the reviewed source.
- Every review recorded `FINALIZED` + `MAJORITY_AGREE`; there were no terminal timeouts or no-majority results.
- Six transient read-poll RPC errors returned HTML instead of JSON. They were logged and recovered by read-only polling; the corresponding runs were not resubmitted.
- A local OneDrive rename lock interrupted one evidence-file write after a transaction finalized. The already-saved transaction ID was reconciled by read-only lookup, no review was repeated, and the writer was changed to direct synchronous writes.
- This rehearsal tests the isolated `CouncilEval` contract, not the game UI or the eight production site contracts. No game/address map/Vercel changes were made.
