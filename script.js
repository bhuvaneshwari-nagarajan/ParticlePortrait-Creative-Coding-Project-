/**
 * Sai Baba - Advanced Cinematic Particle Drawing Engine
 * 
 * Physics-driven, multi-stage photographic reconstruction engine.
 * The original photo is drawn live through progressive edge chains,
 * spring-damper dynamics, curl turbulence, and multi-stage feature revelation.
 */

(function () {
    'use strict';

    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const finalImage = document.getElementById('final-image');
    const reelFrame = document.getElementById('reel-frame');
    const replayBtn = document.getElementById('replay-btn');

    // Stage Timelines (seconds)
    const T_STAGE1_SEED = 0.0;         // Stage 1: Initial small detail starts drawing (0.0s - 2.0s)
    const T_STAGE2_OUTLINE = 2.0;      // Stage 2: Outer contours develop (2.0s - 4.5s)
    const T_STAGE3_STRUCTURE = 4.5;    // Stage 3: Major internal structures appear (4.5s - 7.0s)
    const T_STAGE4_FACE_ROBE = 7.0;    // Stage 4: Face structure & robe folds (7.0s - 9.2s)
    const T_STAGE5_FINE_FACE = 9.2;    // Stage 5: Fine facial features & details (9.2s - 11.5s)
    const T_STAGE6_FILL = 11.5;        // Stage 6: Volumetric shading & completion (11.5s - 13.8s)
    const T_HOLD = 13.8;               // Hold completed particle art (13.8s - 15.2s)
    const T_TRANSFORM = 15.2;          // Brightness surge / convergence (15.2s - 15.8s)
    const T_PHOTO_REVEAL = 15.8;       // Smooth transition to pristine photo (15.8s+)

    let particles = [];
    let drawingTracers = [];
    let animationFrameId = null;
    let startTime = null;
    let isRevealed = false;
    let imgNaturalWidth = 0;
    let imgNaturalHeight = 0;
    let imageLoaded = false;

    // Fast Procedural Smooth Noise (Simplex-approximation)
    const Permutation = new Uint8Array(512);
    for (let i = 0; i < 256; i++) Permutation[i] = Permutation[i + 256] = Math.floor(Math.random() * 256);

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(t, a, b) { return a + t * (b - a); }
    function grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    function noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const u = fade(xf);
        const v = fade(yf);
        const A = Permutation[X] + Y;
        const B = Permutation[X + 1] + Y;
        return lerp(v,
            lerp(u, grad(Permutation[A], xf, yf), grad(Permutation[B], xf - 1, yf)),
            lerp(u, grad(Permutation[A + 1], xf, yf - 1), grad(Permutation[B + 1], xf - 1, yf - 1))
        );
    }

    // Curl noise for organic, fluid-like particle paths
    function curlNoise(x, y, time) {
        const eps = 0.5;
        const n1 = noise2D(x * 0.008, y * 0.008 + time * 0.3);
        const n2 = noise2D(x * 0.008, (y + eps) * 0.008 + time * 0.3);
        const n3 = noise2D((x + eps) * 0.008, y * 0.008 + time * 0.3);
        const dx = (n3 - n1) / eps;
        const dy = (n2 - n1) / eps;
        return { x: dy * 18, y: -dx * 18 };
    }

    // Golden/Amber Palette blended with original photo tones
    function calculateParticleColor(r, g, b, lum, isHighlight) {
        const factor = lum / 255;
        let red, green, blue;

        if (isHighlight) {
            red = Math.round(245 + 10 * factor);
            green = Math.round(210 + 35 * factor);
            blue = Math.round(110 + 90 * factor);
        } else {
            // Warm golden amber tone reflecting photographic shade
            red = Math.round(215 * factor + 40);
            green = Math.round(170 * factor + 30);
            blue = Math.round(75 * factor + 15);
        }

        return {
            r: Math.min(255, Math.max(0, red)),
            g: Math.min(255, Math.max(0, green)),
            b: Math.min(255, Math.max(0, blue)),
            baseAlpha: Math.min(0.95, Math.max(0.4, 0.45 + factor * 0.5))
        };
    }

    // Advanced Physics Particle Class
    class AdvancedParticle {
        constructor(config) {
            this.targetX = config.targetX;
            this.targetY = config.targetY;
            this.spawnX = config.spawnX;
            this.spawnY = config.spawnY;
            this.x = this.spawnX;
            this.y = this.spawnY;
            this.vx = config.initialVx || 0;
            this.vy = config.initialVy || 0;
            this.color = config.color;
            this.size = config.size;
            this.delay = config.delay;
            this.stage = config.stage;
            this.importance = config.importance;
            this.noiseOffset = Math.random() * 1000;
            this.twinklePhase = Math.random() * Math.PI * 2;
            this.settled = false;
        }

        update(elapsed, dt) {
            if (elapsed < this.delay) return;

            const age = elapsed - this.delay;
            
            // Phase: Active Travel & Fluid Navigation (first 1.5s after activation)
            if (age < 2.0) {
                const travelProgress = Math.min(1.0, age / 2.0);
                
                // Spring force toward target
                const springK = 8.0 + travelProgress * 18.0;
                const damping = 0.86 + travelProgress * 0.08;

                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;

                let ax = dx * springK;
                let ay = dy * springK;

                // Add curl turbulence which decays as particle approaches destination
                const turbulenceFactor = (1.0 - travelProgress) * 0.8;
                if (turbulenceFactor > 0.05) {
                    const curl = curlNoise(this.x + this.noiseOffset, this.y + this.noiseOffset, elapsed);
                    ax += curl.x * turbulenceFactor * 20;
                    ay += curl.y * turbulenceFactor * 20;
                }

                this.vx = (this.vx + ax * dt) * damping;
                this.vy = (this.vy + ay * dt) * damping;

                this.x += this.vx * dt;
                this.y += this.vy * dt;
            } else {
                // Settle firmly into exact photographic target coordinates
                if (!this.settled) {
                    this.x += (this.targetX - this.x) * 0.25;
                    this.y += (this.targetY - this.y) * 0.25;
                    if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 0.2) {
                        this.x = this.targetX;
                        this.y = this.targetY;
                        this.settled = true;
                    }
                }
            }
        }

        draw(ctx, elapsed, dpr, surgeAlpha = 0) {
            if (elapsed < this.delay) return;

            const age = elapsed - this.delay;
            let sparkAlpha = 0;
            let currentSize = this.size;

            // Ignition spark when drawing pen deposits this particle
            if (age < 0.35) {
                const sp = age / 0.35;
                sparkAlpha = (1.0 - sp) * 0.6;
                currentSize = this.size * (1.0 + (1.0 - sp) * 0.7);
            }

            // Subtle twinkle
            const twinkle = 0.9 + 0.1 * Math.sin(this.twinklePhase + elapsed * 2.8);
            let alpha = Math.min(1.0, (this.color.baseAlpha * twinkle) + sparkAlpha + surgeAlpha);

            ctx.beginPath();
            ctx.arc(this.x * dpr, this.y * dpr, currentSize * dpr, 0, Math.PI * 2);

            if (sparkAlpha > 0.15 || surgeAlpha > 0.1) {
                ctx.fillStyle = `rgba(255, 248, 200, ${alpha.toFixed(3)})`;
            } else {
                ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${alpha.toFixed(3)})`;
            }
            ctx.fill();
        }
    }

    // Active Drawing Tracer that leads edge strokes
    class DrawingTracer {
        constructor(points, startTime, duration) {
            this.points = points;
            this.startTime = startTime;
            this.endTime = startTime + duration;
            this.trail = [];
        }

        update(elapsed) {
            if (elapsed < this.startTime || elapsed > this.endTime + 0.2 || this.points.length === 0) {
                this.trail = [];
                return;
            }

            const progress = Math.min(1.0, Math.max(0, (elapsed - this.startTime) / (this.endTime - this.startTime)));
            const exactIdx = progress * (this.points.length - 1);
            const idx = Math.floor(exactIdx);
            const nextIdx = Math.min(this.points.length - 1, idx + 1);
            const subProgress = exactIdx - idx;

            const p1 = this.points[idx];
            const p2 = this.points[nextIdx];

            const curX = p1.x + (p2.x - p1.x) * subProgress;
            const curY = p1.y + (p2.y - p1.y) * subProgress;

            this.trail.unshift({ x: curX, y: curY });
            if (this.trail.length > 16) {
                this.trail.pop();
            }
        }

        draw(ctx, dpr) {
            if (this.trail.length < 2) return;

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (let i = 0; i < this.trail.length - 1; i++) {
                const pt1 = this.trail[i];
                const pt2 = this.trail[i + 1];
                const ageFactor = 1.0 - (i / this.trail.length);
                const alpha = ageFactor * 0.8;
                const width = (2.2 * ageFactor) * dpr;

                ctx.beginPath();
                ctx.moveTo(pt1.x * dpr, pt1.y * dpr);
                ctx.lineTo(pt2.x * dpr, pt2.y * dpr);
                ctx.strokeStyle = `rgba(255, 220, 100, ${alpha.toFixed(3)})`;
                ctx.lineWidth = Math.max(1.0, width);
                ctx.stroke();
            }

            const head = this.trail[0];
            ctx.beginPath();
            ctx.arc(head.x * dpr, head.y * dpr, 2.2 * dpr, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 220, 0.95)';
            ctx.fill();

            ctx.restore();
        }
    }

    // Resize canvas
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = reelFrame.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        return dpr;
    }

    // Connect edge points into continuous drawing stroke chains
    function chainPoints(points, maxDist = 26) {
        if (points.length < 2) return [points];

        const chains = [];
        const pool = points.slice();
        const maxDistSq = maxDist * maxDist;

        while (pool.length > 0) {
            const chain = [];
            let current = pool.shift();
            chain.push(current);

            while (pool.length > 0) {
                let nearestIdx = -1;
                let nearestDistSq = Infinity;
                const limit = Math.min(pool.length, 90);

                for (let i = 0; i < limit; i++) {
                    const dx = pool[i].x - current.x;
                    const dy = pool[i].y - current.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < nearestDistSq) {
                        nearestDistSq = distSq;
                        nearestIdx = i;
                    }
                }

                if (nearestIdx !== -1 && nearestDistSq <= maxDistSq) {
                    current = pool.splice(nearestIdx, 1)[0];
                    chain.push(current);
                } else {
                    break;
                }
            }
            chains.push(chain);
        }

        return chains;
    }

    // Deep Image Analysis & Multi-Stage Particle Extraction
    function buildDrawingEngine() {
        if (!imageLoaded) return;

        const frameRect = reelFrame.getBoundingClientRect();
        const frameW = frameRect.width;
        const frameH = frameRect.height;

        const padding = 24;
        const availW = frameW - padding * 2;
        const availH = frameH - padding * 2;

        const imgAspect = imgNaturalWidth / imgNaturalHeight;
        const availAspect = availW / availH;

        let renderW, renderH;
        if (imgAspect > availAspect) {
            renderW = availW;
            renderH = availW / imgAspect;
        } else {
            renderH = availH;
            renderW = availH * imgAspect;
        }

        const renderX = (frameW - renderW) / 2;
        const renderY = (frameH - renderH) / 2;

        // Sample offscreen canvas
        const sampleCanvas = document.createElement('canvas');
        const sampleCtx = sampleCanvas.getContext('2d');
        sampleCanvas.width = Math.round(renderW);
        sampleCanvas.height = Math.round(renderH);

        sampleCtx.drawImage(finalImage, 0, 0, renderW, renderH);

        const imgData = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
        const pixels = imgData.data;
        const sw = sampleCanvas.width;
        const sh = sampleCanvas.height;

        // 1. Luminance and Sobel Edge Gradient
        const lumMap = new Float32Array(sw * sh);
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const idx = (y * sw + x) * 4;
                lumMap[y * sw + x] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            }
        }

        const edgeMap = new Float32Array(sw * sh);
        const angleMap = new Float32Array(sw * sh);
        for (let y = 1; y < sh - 1; y++) {
            for (let x = 1; x < sw - 1; x++) {
                const dx = lumMap[y * sw + (x + 1)] - lumMap[y * sw + (x - 1)];
                const dy = lumMap[(y + 1) * sw + x] - lumMap[(y - 1) * sw + x];
                edgeMap[y * sw + x] = Math.sqrt(dx * dx + dy * dy);
                angleMap[y * sw + x] = Math.atan2(dy, dx);
            }
        }

        // Bounding box of subject
        let minY = sh, maxY = 0;
        for (let y = 0; y < sh; y += 4) {
            for (let x = 0; x < sw; x += 4) {
                if (lumMap[y * sw + x] > 20) {
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        const figH = maxY - minY || sh;
        const centerX = sw * 0.5;

        // Semantic Spatial Zones
        const faceTop = minY + figH * 0.15;
        const faceBottom = minY + figH * 0.43;
        const faceLeft = centerX - sw * 0.20;
        const faceRight = centerX + sw * 0.20;

        // Stage Buckets
        const stage1Seed = [];          // Stage 1: Initial small detail of top head cloth
        const stage2Outline = [];       // Stage 2: Outer contour lines & silhouette
        const stage3Structure = [];     // Stage 3: Major internal posture & robe folds
        const stage4FaceRobe = [];      // Stage 4: Face structure & clothing contours
        const stage5FineFace = [];      // Stage 5: Fine facial features (eyes, nose, lips, beard, tilak)
        const stage6Fill = [];          // Stage 6: Volumetric shading & midtone particles

        const step = 2; // High-density grid sampling

        for (let y = 0; y < sh; y += step) {
            for (let x = 0; x < sw; x += step) {
                const idx = (y * sw + x) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];
                const a = pixels[idx + 3];

                if (a < 25) continue;

                const lum = lumMap[y * sw + x];
                const edge = edgeMap[y * sw + x];
                const angle = angleMap[y * sw + x];

                if (lum < 14) continue; // Skip dark background

                const screenX = renderX + x;
                const screenY = renderY + y;
                const isEdge = edge > 16;
                const isStrongEdge = edge > 26;

                const isFace = (x >= faceLeft && x <= faceRight && y >= faceTop && y <= faceBottom);
                const isHead = (y >= minY && y < faceBottom);
                const isRobe = (y >= faceBottom);

                const item = {
                    x: screenX,
                    y: screenY,
                    r, g, b,
                    lum,
                    edge,
                    angle,
                    isEdge
                };

                if (isFace && isStrongEdge) {
                    // Fine facial features: divine eyes, nose, serene lips, beard fibers
                    stage5FineFace.push(item);
                } else if (isFace && isEdge) {
                    // Face structure, jaw, brow
                    stage4FaceRobe.push(item);
                } else if (isHead && isEdge && y < faceTop && Math.abs(x - centerX) < sw * 0.10) {
                    // Stage 1 seed: very small top head wrap central fold
                    stage1Seed.push(item);
                } else if (isHead && isEdge) {
                    // Stage 2: rest of head outline
                    stage2Outline.push(item);
                } else if (isRobe && isStrongEdge) {
                    // Stage 3: primary robe drape lines & posture
                    stage3Structure.push(item);
                } else if (isEdge) {
                    // Stage 4: secondary clothing boundaries
                    stage4FaceRobe.push(item);
                } else {
                    // Stage 6: volumetric shading fill
                    stage6Fill.push(item);
                }
            }
        }

        particles = [];
        drawingTracers = [];

        // Helper to register continuous drawing stages
        function registerDrawingStage(pointList, startTime, endTime, stageIndex, maxDuration = 1.8) {
            if (pointList.length === 0) return;

            const chains = chainPoints(pointList);
            const totalStageDuration = endTime - startTime;
            const timePerChain = totalStageDuration / Math.max(1, chains.length);

            chains.forEach((chain, cIdx) => {
                if (chain.length === 0) return;

                const chainStart = startTime + cIdx * timePerChain;
                const chainDuration = Math.min(maxDuration, timePerChain * 1.5);

                // Add active drawing tracer for substantial strokes
                if (chain.length >= 4) {
                    drawingTracers.push(new DrawingTracer(chain, chainStart, chainDuration));
                }

                // Create particles along this stroke path
                for (let i = 0; i < chain.length; i++) {
                    const pt = chain[i];
                    const progress = i / chain.length;
                    const delay = chainStart + progress * chainDuration * 0.92;

                    // Particle emerges from tangent of the drawing tip with slight natural momentum
                    const spawnOffsetDist = 12 + Math.random() * 18;
                    const spawnAngle = pt.angle + (Math.random() - 0.5) * 1.2;
                    const spawnX = pt.x + Math.cos(spawnAngle) * spawnOffsetDist;
                    const spawnY = pt.y + Math.sin(spawnAngle) * spawnOffsetDist;

                    const initialVx = -Math.cos(spawnAngle) * (20 + Math.random() * 30);
                    const initialVy = -Math.sin(spawnAngle) * (20 + Math.random() * 30);

                    const isHighlight = pt.lum > 140;
                    const color = calculateParticleColor(pt.r, pt.g, pt.b, pt.lum, isHighlight);
                    const size = 0.75 + (pt.lum / 255) * 0.65; // Precise 0.75px - 1.4px particles

                    particles.push(new AdvancedParticle({
                        targetX: pt.x,
                        targetY: pt.y,
                        spawnX: spawnX,
                        spawnY: spawnY,
                        initialVx: initialVx,
                        initialVy: initialVy,
                        color: color,
                        size: size,
                        delay: delay,
                        stage: stageIndex,
                        importance: pt.edge
                    }));
                }
            });
        }

        // Progressive Sequential Pipeline:
        // Stage 1: Initial small strokes (0.0s - 2.0s)
        registerDrawingStage(stage1Seed, T_STAGE1_SEED, T_STAGE2_OUTLINE, 1, 1.2);

        // Stage 2: Outer contours & silhouette (2.0s - 4.5s)
        registerDrawingStage(stage2Outline, T_STAGE2_OUTLINE, T_STAGE3_STRUCTURE, 2, 1.4);

        // Stage 3: Major structures & robe drapes (4.5s - 7.0s)
        registerDrawingStage(stage3Structure, T_STAGE3_STRUCTURE, T_STAGE4_FACE_ROBE, 3, 1.5);

        // Stage 4: Face structure & clothing details (7.0s - 9.2s)
        registerDrawingStage(stage4FaceRobe, T_STAGE4_FACE_ROBE, T_STAGE5_FINE_FACE, 4, 1.4);

        // Stage 5: Fine facial details (9.2s - 11.5s)
        registerDrawingStage(stage5FineFace, T_STAGE5_FINE_FACE, T_STAGE6_FILL, 5, 1.4);

        // Stage 6: Volumetric shading fill (11.5s - 13.8s)
        registerDrawingStage(stage6Fill, T_STAGE6_FILL, T_HOLD, 6, 1.2);
    }

    let lastTimestamp = 0;

    // Main Engine Loop
    function animate(timestamp) {
        if (!startTime) {
            startTime = timestamp;
            lastTimestamp = timestamp;
        }

        const elapsed = (timestamp - startTime) / 1000;
        const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
        lastTimestamp = timestamp;

        const dpr = window.devicePixelRatio || 1;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Active Drawing Tracers (Light Pens leading strokes)
        if (elapsed < T_HOLD) {
            for (let i = 0; i < drawingTracers.length; i++) {
                drawingTracers[i].update(elapsed);
                drawingTracers[i].draw(ctx, dpr);
            }
        }

        // Calculate transition surge brightness (15.2s - 15.8s)
        let surgeAlpha = 0;
        if (elapsed >= T_TRANSFORM && elapsed < T_PHOTO_REVEAL) {
            const sp = (elapsed - T_TRANSFORM) / (T_PHOTO_REVEAL - T_TRANSFORM);
            surgeAlpha = Math.sin(sp * Math.PI) * 0.45;
        }

        // Update and render all particles
        for (let i = 0; i < particles.length; i++) {
            particles[i].update(elapsed, dt);
            particles[i].draw(ctx, elapsed, dpr, surgeAlpha);
        }

        // Cinematic Transition: Smooth Photo Reveal (15.8s+)
        if (elapsed >= T_PHOTO_REVEAL && !isRevealed) {
            isRevealed = true;
            revealOriginalPhoto();
        }

        if (elapsed < T_PHOTO_REVEAL + 2.5) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Once transition is complete, wipe canvas completely for pristine clarity
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            replayBtn.classList.add('show');
        }
    }

    // Trigger seamless CSS cross-fade to original crystal-clear photo
    function revealOriginalPhoto() {
        canvas.classList.add('fade-out');
        finalImage.classList.add('visible');
    }

    // Start / Restart animation
    function startAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        canvas.classList.remove('fade-out');
        finalImage.classList.remove('visible');
        replayBtn.classList.remove('show');
        isRevealed = false;
        startTime = null;

        resizeCanvas();
        buildDrawingEngine();

        animationFrameId = requestAnimationFrame(animate);
    }

    // Initialization
    function init() {
        finalImage.onload = () => {
            imgNaturalWidth = finalImage.naturalWidth;
            imgNaturalHeight = finalImage.naturalHeight;
            imageLoaded = true;
            startAnimation();
        };

        if (finalImage.complete && finalImage.naturalWidth > 0) {
            imgNaturalWidth = finalImage.naturalWidth;
            imgNaturalHeight = finalImage.naturalHeight;
            imageLoaded = true;
            startAnimation();
        }

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (imageLoaded) {
                    resizeCanvas();
                    buildDrawingEngine();
                }
            }, 250);
        });

        replayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startAnimation();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
