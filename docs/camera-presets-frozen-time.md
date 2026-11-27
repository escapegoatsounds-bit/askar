# New camera presets: moving through frozen time (owner request, 27 Nov 2026)

Add these to `CAMERA` in the Desk (`desk/index.html`, next to the existing 23 presets), with the same fields: `label`, `vid` (video prompt wording), `post` (2.5D/edit note). Also add a matching image-composition rule in `depthFor(cam)` (column "Image needs").

Global video rule for ALL presets (append to every video prompt): "Time is frozen: people and animals are completely still, like a held breath; only dust, sand, water, smoke, light and fabric drift slowly; the camera moves through the still moment."

| key | label | vid (video prompt) | Image needs (depthFor) | post |
|---|---|---|---|---|
| walkThrough | Walk through the frozen moment | smooth eye-level Steadicam walking forward between frozen people, passing them closely on both sides, the scene unfolding in depth | clear walkable gaps between figures, figures at several depths, a path leading into the scene | Needs image-to-video AI with start/end frames; 2.5D only for short moves |
| walkPast | Walk past | smooth tracking shot walking alongside a row of frozen people, the nearest faces sliding past the lens | figures arranged in a line parallel to the camera, near figures large in the foreground | Strong parallax: FG 12%, MG 5%, BG 1% |
| orbitFrozen | Frozen-time orbit (bullet time) | slow 90 to 180 degree arc around the frozen subject caught mid-action, dust and fabric drifting | subject free on all sides with space around it, background visible all round | Keep to 90° (max 180°) or the AI redraws faces; use a character reference image |
| orbitLow | Low hero orbit | low-angle 60 to 90 degree arc looking up at the frozen figure against the sky | low camera, subject against open sky, clear silhouette | Same as orbitFrozen |
| pushUnder | Push under / through | camera glides forward under a raised arm, spear or between animal legs, passing through the frozen action | a clear gap or arch in the foreground framing the action beyond | Needs video AI |
| droneDive | Drone dive to eye level | drone starts high above, dives and levels off at eye height, gliding into the scene | high vantage that still shows the subject, open space to descend into | Use start (aerial) and end (eye-level) frames |
| droneReveal | Drone pull-out reveal | drone flies backwards and upward from the frozen moment until it is tiny in the vast land | subject centred with lots of surrounding landscape, outpaint margins | Scale 140→100% with outpainted edges |
| parallaxPeek | Parallax peek | camera slides out from behind a near object (rock, tent pole, loom, reeds) to reveal the scene | a large dark foreground object filling one side of the frame | FG wipes off frame; MG/BG slide slowly |
| fpv | FPV fly-through | fast fluid racing-drone path threading through gaps in the frozen chaos, banking past figures | many gaps and layers, action spread in depth, clear flight path | Video AI only; use for 1–2 climax frames per episode |

Episode 1 (c. 4500 BC, 66-frame plan) camera assignment, agreed in chat:
1 droneFwd · 2 walkPast→orbitFrozen · 3 droneRise · 4 droneDive · 5 parallaxPeek · 6 walkThrough · 7 orbitLow · 8 slideThrough · 9 walkPast · 10 craneDown · 11 orbitFrozen · 12 rack · 13 walkThrough · 14 droneOrbit · 15 craneOver · 16 walkPast · 17 orbitLow · 18 droneRise ·
19 lean · 20 truckL · 21 droneTop · 22 walkThrough · 23 slideThrough · 24 orbitFrozen · 25 parallaxPeek · 26 craneOver · 27 orbitFrozen · 28 push · 29 droneReveal · 30 fpv ·
31 droneRise · 32 rack · 33 droneTop · 34 walkPast · 35 push · 36 monolith · 37 parallaxPeek · 38 droneDive · 39 orbitFrozen (bass drop) · 40 craneUp · 41 droneOrbit · 42 walkThrough · 43 tiltUp · 44 craneDown · 45 droneReveal · 46 slideThrough · 47 rack · 48 orbitLow ·
49 craneDown · 50 droneRise · 51 droneFwd · 52 walkThrough · 53 orbitFrozen · 54 craneOver · 55 push · 56 walkThrough · 57 droneFwd · 58 walkPast · 59 slideThrough · 60 parallaxPeek · 61 orbitFrozen (macro) · 62 walkPast · 63 rack · 64 craneDown · 65 orbitLow · 66 droneRise

## Episode 1 · Part 3 climax rebuilt: "The Storm Prayer" (frames 31–48, 5:00–8:00) — supersedes frames 31–48 above
Mother and baby battling the sandstorm; the song is her survival prayer. Narration only on frames 32, 39, 45. Effects (speed ramps, crash zooms, shockwaves, lightning flashes, camera shake) are best added in editing, cut to the drum hits; generate clean camera moves in the video AI.
| # | song | frame | camera | effects |
|---|---|---|---|---|
| 31 | hush | dawn, Nebet alone with Wedja on a dune | droneRise | far dust devils, sun turning orange |
| 32 | hush | brown smudge on the horizon ("Then the horizon began to breathe.") | snap zoom face→horizon (push) | heat shimmer, braid lifting |
| 33 | verse 1 | km-high storm wall swallowing the sun to a red disc | droneDive | blood-red sun through dust |
| 34 | verse 1 | Nebet frozen mid-run, wall behind | walkPast (running height) | sand streaming in sheets |
| 35 | verse 1 | the wall reaches her: half gold light, half brown night | pushUnder the curling front | shockwave of sand |
| 36 | chorus 1 | she folds over Wedja, dress/hair horizontal | orbitFrozen 180° | sand grains hanging like stars; speed ramp in edit |
| 37 | chorus 1 | faint sand-and-light silhouettes of gods behind her (sun-disc, wings, lioness) | parallaxPeek past her shoulder | gods half visible, vanish |
| 38 | chorus 1 | the wind tears the water skin away | fpv (macro) following the skin | motion trails on sand only |
| 39 | verse 2 | on her knees, head back, answering the prayer ("I didn't know their names. I called them anyway.") | orbitLow | dry lightning inside the dust lights her face |
| 40 | verse 2 | the eye: still light, sand hanging like a frozen curtain | walkThrough the sand curtain | 2 s of silence, drums return |
| 41 | chorus 2 | she stands and walks into the storm, shielding Wedja | craneUp feet→sky | god silhouettes clearer around her |
| 42 | chorus 2 | tiny Nebet walking between colossal sand-gods | walkThrough between their feet | volumetric light shafts |
| 43 | chorus 2 | Set made of the storm towers over her | tiltUp, Dutch angle | lightning in his outline |
| 44 | BASS DROP | Nebet mid-scream braced, Wedja's hand gripping her braid | fpv spiral ending on Wedja's eye | sand shockwave, crash zoom, lightning on the beat |
| 45 | drop chorus | Sobek rises from a river of light beneath Set ("Water, in the middle of the sand.") | droneOrbit pulling out | sand→water→light |
| 46 | outro | dark overhang in a cliff; she crawls toward it | slideThrough blowing sand | storm thinning in waves |
| 47 | outro choir | the wall rolls on, gold light behind | droneReveal | sun breaks through white |
| 48 | tail | under the overhang, sand settling like snow; Wedja touches her dusty cheek | push to faces | single held choir note, then wind and breath |
Accuracy: haboob walls of 1 km+ and dry lightning in dust storms are real. Gods remain a vision for the audience; Nebet prays without names. Cave stencils move to the start of Part 4.
