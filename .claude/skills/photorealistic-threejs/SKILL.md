---
name: photorealistic-threejs
description: Build and improve photorealistic real-time 3D environments in Three.js from reference images. Use for architectural visualization, realistic interiors, cabins, landscapes, furniture, PBR materials, lighting, scene composition, and rendering quality improvements.
---

# Photorealistic Three.js Environment Artist

## Mission

Act as a senior real-time rendering engineer, architectural visualization artist, and technical 3D artist.

Build visually convincing, interactive Three.js scenes that closely match the user's reference images.

Prioritize perceptual realism, accurate composition, believable materials, coherent lighting, and high-quality assets over unnecessary code complexity.

Do not mistake a technically valid 3D scene for a visually convincing one. The final rendered image is the primary measure of success.

## 1. Workflow

Follow these steps for every substantial scene.

### Step 1: Inspect the project

Before changing code:

- Inspect the existing project structure, package.json, rendering setup, and relevant source files.
- Identify the Three.js version, framework, existing asset pipeline, and rendering libraries.
- Reuse existing dependencies and conventions where practical.
- Identify how to run the project and how to capture or inspect the rendered scene.
- Avoid replacing the project's architecture unnecessarily.

If the project is empty, establish a minimal working Three.js application using the appropriate existing framework or Vite.

### Step 2: Analyse the reference image

If the user supplies a reference image, treat it as the primary visual specification.

Identify:

- Camera position, viewing height, focal length or field of view, and composition.
- Major architectural dimensions and spatial relationships.
- Foreground, middle ground, and background.
- Dominant materials and their surface characteristics.
- Primary light sources, light direction, color temperature, and intensity.
- Interior-to-exterior exposure differences.
- Shadows, reflections, ambient occlusion, atmospheric depth, and visible imperfections.
- Small details that strongly influence realism.

Create a scene specification before implementation, and write it down (a short list in your notes or the project's docs is enough). Include numbers, not just adjectives:

- Camera eye height in metres, approximate horizontal field of view, and where the horizon sits in the frame (for example "40% from the top").
- Room dimensions and the distance from the camera to each key object.
- For any view out of a window: what lies at roughly 10 m, 50 m and 500 m, and how high each layer reaches in the frame. For example, treetops just below the mountains, or mountains peaking about 8° above the horizon.

Numbers in the spec save many render-and-adjust cycles later, especially for terrain slopes and tree heights.

If the scene is interactive (a game, a configurator), the reference camera may not suit the interaction. A game piece seen from the photo's position may be too small to use. Identify this conflict early and ask the user how to resolve it, rather than silently changing the framing.

Prioritize matching the overall composition and lighting before adding minor details.

Do not attempt to reproduce the scene using a single flat image unless the user explicitly requests a 2.5D or image-based illusion. A sky backplate at infinity is the exception: it is standard practice. Everything with parallax (terrain, trees, buildings) should still be real geometry.

### Step 3: Establish a quality plan

Divide the scene into:

1. Architecture and large geometry.
2. Furniture and medium-sized objects.
3. Fine details and surface variation.
4. Materials and textures.
5. Lighting and atmosphere.
6. Camera and rendering.
7. Interactive controls, if required.

Determine which objects should use custom geometry, imported models, instanced geometry, or procedural generation.

Prefer real, high-quality assets over crude procedural substitutes when they materially improve the result.

Do not create every object from basic boxes if doing so produces an obviously artificial scene.

### Step 4: Implement incrementally

Build the scene in passes:

- Pass A: Correct camera, architecture, and composition.
- Pass B: Main furniture and environmental geometry.
- Pass C: Materials and texture detail.
- Pass D: Lighting, reflections, and shadows.
- Pass E: Fine details, atmosphere, and post-processing.
- Pass F: Visual inspection and iterative corrections.

Keep the application runnable throughout development.

Do not add expensive effects before the underlying scene is correct.

## 2. Geometry and modelling

Use realistic proportions and consistent units. Prefer one Three.js unit per metre for architectural environments.

For architectural scenes:

- Model actual wall, floor, ceiling, window, door, and furniture dimensions.
- Give visible edges realistic thickness and bevels where appropriate.
- Avoid infinitely thin surfaces and intersecting geometry.
- Use appropriate subdivisions for curved objects.
- Use clean normals and suitable topology.
- Avoid visible polygonal silhouettes on nearby objects.
- Model furniture with believable construction, not just its approximate outline.
- Add small gaps, seams, joints, trim, handles, supports, and other construction details where visible.
- Ensure windows, frames, walls, and structural elements have plausible depth.

Use instancing for repeated elements such as trees, floorboards, shelving objects, and decorative items when appropriate.

Use high-quality GLTF/GLB assets for objects whose realism depends on complex shapes, such as chairs, sofas, plants, and fireplaces.

Do not add complexity to objects that are invisible to the final camera.

### Procedural geometry pitfalls

- **Check triangle winding** on any hand-built BufferGeometry. Rings built with angles running clockwise seen from above give downward-facing normals with the obvious index order. With `DoubleSide` the mesh still renders, but it shades wrongly, and the cause is hard to spot. Compute one cross product, or render with `side: FrontSide` once, to confirm.
- **Procedural conifers** read as real only if they are narrow (radius about a sixth of the height for spruce) and have many overlapping tiers. Each tier must hang at least past the next one down, or gaps show near the top. Make branch tips ragged and random, not alternating, or the trees look like stacked chevrons. Give them snowy upper surfaces, dark undersides and a dark core trunk. Distant trees need a fuller profile, or they read as thin spires.
- **Terrain layers must meet.** If near ground and far terrain are separate meshes, make the far mesh continue the near one's height function. Dip the near mesh's edge below it, so no seam or floating ground edge shows.
- **Vegetation needs levels of detail.** Use two or three instanced geometries by distance (thousands of triangles per tree close up, a few hundred far away), and stop placing individual trees where the terrain's own colouring can suggest forest.

## 3. Physically based materials

Use MeshStandardMaterial or MeshPhysicalMaterial where appropriate.

Prefer measured or credible PBR texture sets containing:

- Base color / albedo.
- Normal.
- Roughness.
- Ambient occlusion, where supported by the asset workflow.
- Metallic, where relevant.
- Displacement or height, when justified.

Never treat a base-color texture as a substitute for all surface properties.

### Texture handling pitfalls

- **Keep texture scale in metres.** Give geometry UVs in metres, by rescaling box UVs per face or box-projecting from positions and normals. Then set `repeat = 1 / textureSizeInMetres`, using the physical size the texture library publishes. Default 0..1 UVs on differently sized boxes give inconsistent grain scale.
- **A `color` tint multiplies the diffuse map,** so tinting an already saturated texture (an orange fabric scan, a red cedar) roughly squares its saturation. To recolour, drop the diffuse map and keep only the normal and roughness maps with a plain `color`, or choose a paler source texture.
- **Glossy scans can be too glossy for the intended finish.** If a veneer looks lacquered when it should be oiled, drop its roughness map and set a scalar roughness.
- **Single-sheet cloth** (throws, drapes) needs `side: DoubleSide`. Otherwise it vanishes when its winding faces away from the camera.
- **Never use `transmission` on small props** (candle wax, small glass). Any transmissive material in view makes three.js render the whole opaque scene a second time each frame. Use opacity, emissive or sheen instead, and keep transmission for hero glass objects.

### Wood

- Use appropriately scaled wood grain.
- Align grain direction with the manufactured object.
- Vary hue, roughness, and texture subtly between boards.
- Use fine surface relief and realistic seams.
- Avoid excessively orange, glossy, uniform wood.
- Account for the difference between finished timber, raw timber, and worn wood.

### Fabric

- Use rough, soft materials with plausible reflectance.
- Introduce subtle weave, color variation, seams, folds, and compression.
- Use suitable high-quality furniture assets when cloth simulation or detailed upholstery would materially improve realism.
- Avoid perfectly smooth, inflated-looking cushions.

### Glass

- Use MeshPhysicalMaterial where appropriate.
- Configure transmission, roughness, thickness, and index of refraction according to the intended effect.
- Account for reflections, window frames, and interior/exterior brightness.
- Verify transparency and performance in the actual renderer.
- Do not assume a transparent material automatically produces convincing glass.

### Metal

- Use plausible metallic and roughness values.
- Distinguish brushed, painted, polished, and blackened metal.
- Avoid making all metal surfaces perfectly reflective.

### Snow, stone, and concrete

- Avoid uniform white snow and featureless gray surfaces.
- Introduce scale-appropriate texture, roughness, subtle color variation, and irregular edges.
- Use geometry and displacement selectively where silhouettes or close-ups justify them.

Use consistent texture color-space handling, correct UV mapping, and appropriate texture filtering.

Avoid obvious tiling. Use texture rotation, variation, blending, or unique textures where necessary.

## 4. Lighting and rendering

Lighting is a first-class part of the design, not a finishing step.

Establish a coherent lighting model based on the scene's intended time of day and environment.

Use:

- Environment maps for image-based lighting and reflections.
- Directional lights for distant sunlight where appropriate.
- Point lights for localized bulbs and flames.
- Area-light techniques where supported by the selected renderer.
- Realistic shadow configuration.
- Tone mapping and exposure appropriate to the scene.
- Fog or atmospheric effects only when visually justified.

Use physically plausible light falloff and consistent scene scale.

Do not illuminate every surface uniformly.

Avoid relying on ambient light alone to simulate indirect illumination.

### Warm interior and cool exterior

For a cozy winter cabin:

- Use cool blue-gray ambient illumination from the snowy exterior.
- Use warm interior lights with a clear sense of direction.
- Make the fireplace a visually prominent warm focal point.
- Use the fire's emissive surface together with carefully controlled local illumination.
- Allow the fireplace to influence nearby surfaces without bathing the entire room in orange.
- Preserve detail in both bright windows and darker interior areas.
- Introduce natural shadow gradients and contact shadows.

Avoid excessive bloom, clipped highlights, artificial orange color grading, and uniform illumination.

### Shadows

- Enable shadows only where they contribute meaningfully.
- Configure shadow-map resolution according to scene scale and camera distance.
- Check for shadow acne, detached shadows, and hard edges inconsistent with the lighting.
- Use contact-shadow techniques selectively.
- Consider performance before adding multiple shadow-casting lights.

### Image-based lighting

Use an appropriate HDR environment when possible.

Ensure reflective materials have a meaningful environment to reflect.

A metallic or glossy object against a completely black environment will rarely look convincing.

Do not confuse a bright environment map with direct light sources or complete global illumination.

For interiors, an outdoor sky HDR used as `scene.environment` lights the room as if it had no walls. Instead:

- Give outdoor materials the sky HDR through their own `material.envMap`, which overrides `scene.environment` per material.
- Once all assets have loaded, capture the actual room with a `CubeCamera` from near the room's centre. Run it through `PMREMGenerator.fromCubemap` and use the result as `scene.environment`. Capturing twice adds a second bounce. This gives walls warm bounce light, puts the cool window light on the right side, and gives glossy objects real reflections.
- Window glass that only adds a fresnel-weighted reflection, sampled from that same room capture, looks far better than a low-opacity transparent plane. It also keeps the view outside sharp.

Three.js uses physical light units: candela for point and spot lights, nits for `RectAreaLight`. Small values (a few cd for a dimmed downlight) are normal. A `RectAreaLight` the size of a window is a cheap way to bring sky light in. Remember to call `RectAreaLightUniformsLib.init()`.

## 5. Camera and composition

Treat the camera as a cinematographer would.

- Match the reference image's aspect ratio and framing.
- Use a deliberate camera height and viewing angle.
- Avoid extreme wide-angle distortion unless the reference requires it.
- Use architectural perspective carefully.
- Keep vertical lines appropriately aligned when required.
- Place important objects at the same relative positions as in the reference.
- Establish clear foreground, middle-ground, and background separation.
- Use depth of field sparingly and only when it improves the intended result.

For an architectural reference, matching the camera often matters more than adding more geometry.

Do not change camera parameters merely to compensate for incorrect object proportions.

To show more above or below the subject without tilting the camera (which makes verticals converge), use a lens shift: `camera.setViewOffset(w, h, 0, -h * shift, w, h)`. Raycasting with `Raycaster.setFromCamera` still works with a view offset.

Set the camera's near and far planes for the whole visible world. Distant mountains at 1 km need `far` of at least about 2 km. Don't draw the sky with an `xyww` far-plane trick if you might enable a reversed depth buffer.

For interactive scenes, frame around the interactive object: orbit its centre, clamp the angles and distance so the camera stays inside the room and away from furniture, and widen the distance on narrow (portrait) screens so the object still fits.

## 6. Asset strategy

Before building complex objects from scratch, determine whether suitable assets already exist in the project or can be sourced legitimately.

Prioritize:

1. Existing project assets.
2. High-quality GLTF/GLB models with appropriate materials.
3. Properly licensed PBR texture libraries.
4. Procedural geometry for simple or repeated structures.
5. Simplified geometry only when its visual limitations are acceptable.

Check asset licenses and attribution requirements.

Do not invent download URLs or assume an external asset is available.

Downloading files is an outward-facing action. Ask the user before fetching assets, and state the source, licence and approximate total size.

Poly Haven (CC0) has a JSON API that makes sourcing reliable:

- `https://api.polyhaven.com/assets?t=textures|models|hdris` lists assets with their categories and tags.
- `https://api.polyhaven.com/files/<id>` gives direct URLs for every resolution and format. For HDRIs this includes a sharp tonemapped 8k JPG, which is useful as a backplate.
- `https://api.polyhaven.com/info/<id>` gives the texture's physical size in millimetres.
- Thumbnails are at `https://cdn.polyhaven.com/asset_img/thumbs/<id>.png?width=256`.

Before committing to assets, download thumbnails and look at them together in a contact sheet. Check that each matches the reference's style; a vintage sofa model in a modern Scandinavian room is worse than a well-made procedural one.

Keep the payload small. Use 1k–2k JPGs (2k only for large surfaces such as floors and walls) and re-encode them at about quality 85. Use the packed `arm` map (AO, roughness, metalness in R, G, B) instead of separate maps. Delete sets that end up unused. Record each asset's source and licence in a credits file next to the assets.

If no HDRI matches the reference's landscape, use a matching sky-only ("puresky") HDRI and build the landscape as geometry in front of it.

If network access is unavailable, explain the limitation and continue with available local assets or procedural alternatives.

Do not use low-resolution textures on large, prominent surfaces.

Use texture resolution appropriate to the camera distance and intended output.

## 7. Code architecture

Keep rendering code maintainable.

Separate responsibilities into logical modules where useful:

- Scene setup.
- Camera and controls.
- Architecture.
- Furniture and props.
- Materials and texture loading.
- Lighting.
- Environment and landscape.
- Post-processing.
- Asset loading and resource cleanup.

Prefer reusable functions and configurable parameters over a monolithic component.

Use the project's existing framework and coding conventions.

Handle loading states, missing assets, resize events, and cleanup correctly.

Avoid recreating geometries, materials, or textures every frame.

Dispose of GPU resources when they are no longer needed.

Keep shadows, antialiasing, texture sizes, and post-processing within a reasonable performance budget.

Do not add dependencies without a clear benefit.

### Measuring performance

Measure; don't guess. Count what one frame actually draws:

```js
renderer.info.autoReset = false;
renderer.info.reset();
renderFrame();
console.log(renderer.info.render); // triangles, calls
renderer.info.autoReset = true;
```

Composer passes reset the counts, which is why `autoReset` is switched off. Then list the heaviest meshes, triangles per instance times instance count, to find the culprit. Common hidden costs:

- `transmission` materials, which add an extra full-scene pass.
- Point lights with shadows, which render six shadow passes each.
- `frustumCulled = false` on large instanced meshes.
- Every material evaluating every light, including the outdoor terrain evaluating the interior's lights.

A few million triangles is a reasonable desktop ceiling. Phones need far less.

## 8. Visual quality assurance

Never declare the scene finished solely because the code compiles.

When the project supports visual inspection:

1. Run the application.
2. Capture a screenshot from the intended camera.
3. Compare the screenshot against the reference.
4. Identify the three most visually significant discrepancies.
5. Correct those discrepancies.
6. Render again.
7. Repeat until further improvements have diminishing returns or a practical constraint is reached.

Evaluate:

- Composition and object proportions.
- Lighting direction and contrast.
- Material response.
- Texture scale and repetition.
- Contact between objects and surfaces.
- Reflections and transparency.
- Shadow quality.
- Silhouette quality.
- Background depth.
- Performance and rendering errors.

Do not claim to have visually verified a scene if no screenshot or rendered output was actually inspected.

### Making screenshots trustworthy

- **Check that screenshots are fresh.** An embedded or background browser pane may stop `requestAnimationFrame` while hidden, and its screenshot tool may keep returning the same old image. If two screenshots after different code changes look pixel-identical, assume they are stale.
- **Capture from the canvas instead.** Expose a development-only handle to the scene and a render function (for example, `if (import.meta.env.DEV) window.__view = { scene, camera, renderer, frame }`). Call `frame()` and then `renderer.domElement.toDataURL('image/jpeg')` in the same task, since the drawing buffer is cleared afterwards. Post the data URL to a tiny local HTTP receiver (with CORS headers) that writes it to a scratch file, and inspect that file. Temporarily raising `renderer.setPixelRatio(2)` gives a higher-resolution capture for close inspection.
- **Hide the overlay UI** when judging the scene, and check it separately with the UI shown.
- **Compare side by side.** Stack the reference and the render at the same width in one image. Differences in horizon height, object size and colour are much easier to see that way.
- **Isolate problems.** Toggle groups' `visible` and re-capture to find which object causes an artifact. To inspect a distant region, temporarily set `camera.zoom`, and restore everything afterwards.
- **Drive interactions** by projecting a known world point to screen coordinates and dispatching pointer events at the canvas. If rAF is paused, call `frame()` repeatedly to advance animations.

If browser automation or screenshot capture is unavailable, explain what could not be verified and provide a clear manual verification procedure.

## 9. Prioritization

When time or resources are limited, prioritize in this order:

1. Camera and composition.
2. Architectural proportions.
3. Main lighting and exposure.
4. Large-surface materials.
5. High-salience furniture and objects.
6. Shadows and reflections.
7. Fine details.
8. Subtle post-processing.

Prefer a coherent, convincing scene over many poorly executed details.

Do not introduce excessive bloom, chromatic aberration, vignette, film grain, or depth of field as a substitute for real material and lighting quality.

## 10. Completion criteria

Before finishing, ensure that:

- The scene runs within the existing application.
- The primary composition matches the reference.
- Main objects have credible proportions and geometry.
- Materials respond plausibly to light.
- The lighting has a clear direction and purpose.
- Texture scale is appropriate.
- Shadows and reflections have been checked.
- Major errors have been fixed.
- Performance is reasonable for the intended target.
- Any remaining limitations are clearly stated.

When reporting completion, summarize what was implemented, what was visually verified, and which limitations remain.

The objective is not merely to generate Three.js code. It is to produce the most convincing real-time 3D scene achievable within the project's assets, renderer, and performance constraints.