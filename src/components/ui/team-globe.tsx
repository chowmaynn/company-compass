"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { useWhosOut } from "@/hooks/use-whos-out";

// ── Team pin interface ────────────────────────────────────────

export interface TeamPin {
  firstName: string;
  displayName: string;
  lat: number;
  lng: number;
  department?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────

function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(point: [number, number], feature: any): boolean {
  const geometry = feature.geometry;
  if (geometry.type === "Polygon") {
    if (!pointInPolygon(point, geometry.coordinates[0])) return false;
    for (let i = 1; i < geometry.coordinates.length; i++) {
      if (pointInPolygon(point, geometry.coordinates[i])) return false;
    }
    return true;
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      if (pointInPolygon(point, polygon[0])) {
        let inHole = false;
        for (let i = 1; i < polygon.length; i++) {
          if (pointInPolygon(point, polygon[i])) { inHole = true; break; }
        }
        if (!inHole) return true;
      }
    }
  }
  return false;
}

function generateDotsInPolygon(feature: any, dotSpacing = 16): [number, number][] {
  const dots: [number, number][] = [];
  const bounds = d3.geoBounds(feature);
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const stepSize = dotSpacing * 0.08;
  for (let lng = minLng; lng <= maxLng; lng += stepSize) {
    for (let lat = minLat; lat <= maxLat; lat += stepSize) {
      const point: [number, number] = [lng, lat];
      if (pointInFeature(point, feature)) dots.push(point);
    }
  }
  return dots;
}

// ── Component ─────────────────────────────────────────────────

interface TeamGlobeProps {
  width?: number;
  height?: number;
  className?: string;
  pins?: TeamPin[];
}

export default function TeamGlobe({
  width = 600,
  height = 600,
  className = "",
  pins = [],
}: TeamGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { outFirstNames } = useWhosOut();

  // Stable ref for vacation data so the render loop sees updates without re-mounting
  const outRef = useRef(outFirstNames);
  useEffect(() => { outRef.current = outFirstNames; }, [outFirstNames]);

  // Stable ref for pins
  const pinsRef = useRef(pins);
  useEffect(() => { pinsRef.current = pins; }, [pins]);

  const setupGlobe = useCallback(() => {
    if (!canvasRef.current) return () => {};

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return () => {};

    const containerWidth = Math.min(width, window.innerWidth - 40);
    const containerHeight = Math.min(height, window.innerHeight - 100);
    const radius = Math.min(containerWidth, containerHeight) / 2.5;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    context.scale(dpr, dpr);

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90);

    const path = d3.geoPath().projection(projection).context(context);

    interface DotData { lng: number; lat: number; }
    const allDots: DotData[] = [];
    let landFeatures: any;

    // ── Render frame ───────────────────────────────────
    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight);
      const currentScale = projection.scale();
      const scaleFactor = currentScale / radius;

      // Ocean
      context.beginPath();
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI);
      context.fillStyle = "#0a0a0a";
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.15)";
      context.lineWidth = 1.5 * scaleFactor;
      context.stroke();

      if (landFeatures) {
        // Graticule
        const graticule = d3.geoGraticule();
        context.beginPath();
        path(graticule());
        context.strokeStyle = "rgba(255,255,255,0.08)";
        context.lineWidth = 0.5 * scaleFactor;
        context.stroke();

        // Land outlines
        context.beginPath();
        landFeatures.features.forEach((feature: any) => path(feature));
        context.strokeStyle = "rgba(255,255,255,0.18)";
        context.lineWidth = 0.8 * scaleFactor;
        context.stroke();

        // Halftone dots
        for (const dot of allDots) {
          const projected = projection([dot.lng, dot.lat]);
          if (projected) {
            context.beginPath();
            context.arc(projected[0], projected[1], 1 * scaleFactor, 0, 2 * Math.PI);
            context.fillStyle = "rgba(255,255,255,0.25)";
            context.fill();
          }
        }

        // ── Team member pins ─────────────────────────────
        const currentOut = outRef.current;
        for (const pin of pinsRef.current) {
          const projected = projection([pin.lng, pin.lat]);
          if (!projected) continue;

          const isOut = currentOut.has(pin.firstName.toLowerCase());
          const pinRadius = 4 * scaleFactor;
          const glowRadius = 8 * scaleFactor;

          // Glow halo
          const gradient = context.createRadialGradient(
            projected[0], projected[1], 0,
            projected[0], projected[1], glowRadius
          );
          if (isOut) {
            gradient.addColorStop(0, "rgba(239,68,68,0.5)");
            gradient.addColorStop(1, "rgba(239,68,68,0)");
          } else {
            gradient.addColorStop(0, "rgba(52,211,153,0.5)");
            gradient.addColorStop(1, "rgba(52,211,153,0)");
          }
          context.beginPath();
          context.arc(projected[0], projected[1], glowRadius, 0, 2 * Math.PI);
          context.fillStyle = gradient;
          context.fill();

          // Pin dot
          context.beginPath();
          context.arc(projected[0], projected[1], pinRadius, 0, 2 * Math.PI);
          context.fillStyle = isOut ? "#ef4444" : "#34d399";
          context.fill();
          context.strokeStyle = "rgba(0,0,0,0.4)";
          context.lineWidth = 1 * scaleFactor;
          context.stroke();

          // Name label
          context.font = `${Math.round(9 * scaleFactor)}px ui-sans-serif, system-ui, sans-serif`;
          context.fillStyle = isOut ? "rgba(239,68,68,0.9)" : "rgba(255,255,255,0.75)";
          context.textBaseline = "middle";
          context.fillText(
            isOut ? `🌴 ${pin.firstName}` : pin.firstName,
            projected[0] + pinRadius + 3 * scaleFactor,
            projected[1]
          );
        }
      }
    };

    // ── Load world data ───────────────────────────────
    const loadWorldData = async () => {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json"
        );
        if (!response.ok) throw new Error("Failed to load land data");
        landFeatures = await response.json();

        for (const feature of landFeatures.features) {
          const dots = generateDotsInPolygon(feature, 16);
          for (const [lng, lat] of dots) allDots.push({ lng, lat });
        }
        render();
      } catch (err) {
        console.error("[team-globe] Failed to load world data:", err);
      }
    };

    // ── Rotation + interaction ─────────────────────────
    const rotation: [number, number] = [0, 0];
    let autoRotate = true;

    const rotate = () => {
      if (autoRotate) {
        rotation[0] += 0.3;
        projection.rotate(rotation);
        render();
      }
    };

    const rotationTimer = d3.timer(rotate);

    const handleMouseDown = (event: MouseEvent) => {
      autoRotate = false;
      const startX = event.clientX;
      const startY = event.clientY;
      const startRotation: [number, number] = [...rotation];

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        rotation[0] = startRotation[0] + dx * 0.5;
        rotation[1] = startRotation[1] - dy * 0.5;
        rotation[1] = Math.max(-90, Math.min(90, rotation[1]));
        projection.rotate(rotation);
        render();
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setTimeout(() => { autoRotate = true; }, 10);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newRadius = Math.max(radius * 0.5, Math.min(radius * 3, projection.scale() * scaleFactor));
      projection.scale(newRadius);
      render();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    loadWorldData();

    return () => {
      rotationTimer.stop();
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [width, height]);

  useEffect(() => {
    const cleanup = setupGlobe();
    return cleanup;
  }, [setupGlobe]);

  return (
    <div className={`relative flex justify-center overflow-visible ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}
