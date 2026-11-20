/**
 * WebGL capability and software-renderer detection.
 * Used strictly to tune rendering cost (pixel ratio, antialiasing, frame pacing)
 * without altering scene content, geometry, or layout.
 */

export interface WebGLCapabilitiesInfo {
  supported: boolean;
  isSoftwareGl: boolean;
  rendererString: string;
  isMobileViewport: boolean;
}

let cachedCapabilities: WebGLCapabilitiesInfo | null = null;

export function detectWebGLCapabilities(): WebGLCapabilitiesInfo {
  if (cachedCapabilities) return cachedCapabilities;

  const isMobileViewport =
    typeof window !== 'undefined' &&
    (window.innerWidth <= 820 ||
      (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)));

  if (typeof document === 'undefined') {
    cachedCapabilities = {
      supported: false,
      isSoftwareGl: true,
      rendererString: 'ssr',
      isMobileViewport,
    };
    return cachedCapabilities;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);

    if (!gl) {
      cachedCapabilities = {
        supported: false,
        isSoftwareGl: true,
        rendererString: 'unavailable',
        isMobileViewport,
      };
      return cachedCapabilities;
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const param = debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererString = String(gl.getParameter(param) || 'unknown');
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa OffScreen/i.test(
      rendererString
    );

    gl.getExtension('WEBGL_lose_context')?.loseContext();

    cachedCapabilities = {
      supported: true,
      isSoftwareGl,
      rendererString,
      isMobileViewport,
    };
    return cachedCapabilities;
  } catch {
    cachedCapabilities = {
      supported: false,
      isSoftwareGl: true,
      rendererString: 'error',
      isMobileViewport,
    };
    return cachedCapabilities;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
