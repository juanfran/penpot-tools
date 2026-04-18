import { describe, expect, it } from 'vitest';
import { buildGoogleFontsUrls } from './fonts';

describe('buildGoogleFontsUrls', () => {
  it('agrupa por fontFamily, elimina duplicados y genera una URL por familia', () => {
    const fonts = [
      { fontFamily: 'Work Sans', fontWeight: '400', fontStyle: 'normal' },
      { fontFamily: 'Work Sans', fontWeight: '500', fontStyle: 'normal' },
      { fontFamily: '"Work Sans"', fontWeight: '500', fontStyle: 'normal' },
      {
        fontFamily: 'Inclusive Sans',
        fontWeight: '400',
        fontStyle: 'normal',
      },
    ] as const;

    expect(buildGoogleFontsUrls(fonts)).toEqual([
      'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500&display=swap',
      'https://fonts.googleapis.com/css2?family=Inclusive+Sans:wght@400&display=swap',
    ]);
  });

  it('limpia comillas y espacios extra en fontFamily', () => {
    const fonts = [
      {
        fontFamily: '  "Work   Sans"  ',
        fontWeight: '400',
        fontStyle: 'normal',
      },
    ] as const;

    expect(buildGoogleFontsUrls(fonts)).toEqual([
      'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400&display=swap',
    ]);
  });

  it('soporta variantes normal e italic en la misma familia', () => {
    const fonts = [
      { fontFamily: 'Roboto', fontWeight: '700', fontStyle: 'italic' },
      { fontFamily: 'Roboto', fontWeight: '400', fontStyle: 'normal' },
      { fontFamily: 'Roboto', fontWeight: '400', fontStyle: 'italic' },
    ] as const;

    expect(buildGoogleFontsUrls(fonts)).toEqual([
      'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;1,400;1,700&display=swap',
    ]);
  });

  it('ordena pesos y variantes aunque el input venga desordenado', () => {
    const fonts = [
      { fontFamily: 'Inter', fontWeight: '700', fontStyle: 'normal' },
      { fontFamily: 'Inter', fontWeight: '400', fontStyle: 'normal' },
      { fontFamily: 'Inter', fontWeight: '500', fontStyle: 'normal' },
    ] as const;

    expect(buildGoogleFontsUrls(fonts)).toEqual([
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap',
    ]);
  });

  it('acepta fontWeight numérico', () => {
    const fonts = [
      { fontFamily: 'Manrope', fontWeight: 400, fontStyle: 'normal' },
      { fontFamily: 'Manrope', fontWeight: 600, fontStyle: 'normal' },
    ] as const;

    expect(buildGoogleFontsUrls(fonts)).toEqual([
      'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap',
    ]);
  });
});
