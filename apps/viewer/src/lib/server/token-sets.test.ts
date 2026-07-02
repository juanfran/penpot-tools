import { describe, expect, it } from 'vitest';
import transit from 'transit-js';
import { extractTokenSetsFromTokensLib } from './token-sets';

const reader = transit.reader('json');

describe('extractTokenSetsFromTokensLib', () => {
  it('reads Penpot tagged Transit token libraries', () => {
    const tokensLib = reader.read(
      JSON.stringify([
        '~#penpot/tokens-lib',
        [
          '^ ',
          '~:sets',
          [
            '^ ',
            'light',
            [
              '^ ',
              '~:name',
              'Light',
              '~:tokens',
              [
                '^ ',
                'colors',
                ['^ ', 'background', ['^ ', '$type', 'color', '$value', '#ffffff']],
              ],
            ],
          ],
        ],
      ]),
    );

    expect(extractTokenSetsFromTokensLib(tokensLib)).toEqual([
      {
        id: 'set:Light',
        name: 'Light',
        css: ':root {\n    --colors-background: #ffffff;\n  }',
        kind: 'set',
        tokenCount: 1,
      },
    ]);
  });

  it('reads flat DTCG maps accepted by create_token_set', () => {
    const sets = extractTokenSetsFromTokensLib({
      dark: {
        bg: { $type: 'color', $value: '#111111' },
        fg: { $type: 'color', $value: '#eeeeee' },
      },
    });

    expect(sets).toEqual([
      {
        id: 'set:dark',
        name: 'dark',
        css: ':root {\n    --bg: #111111;\n    --fg: #eeeeee;\n  }',
        kind: 'set',
        tokenCount: 2,
      },
    ]);
  });

  it('flattens Penpot ordered-map groups and builds theme CSS from selected sets', () => {
    const tokensLib = reader.read(
      JSON.stringify([
        '~#penpot/tokens-lib',
        [
          '^ ',
          '~:sets',
          [
            '~#ordered-map',
            [
              [
                'G-Tier 1 - Primitive',
                [
                  '~#ordered-map',
                  [
                    [
                      'S-Colors',
                      [
                        '~#penpot/token-set',
                        [
                          '^ ',
                          '~:name',
                          'Tier 1 - Primitive/Colors',
                          '~:tokens',
                          [
                            '~#ordered-map',
                            [
                              ['teal.600', ['^ ', '~:type', '~:color', '~:value', '#008080']],
                            ],
                          ],
                        ],
                      ],
                    ],
                  ],
                ],
              ],
              [
                'G-Tier 2 - Semantic',
                [
                  '~#ordered-map',
                  [
                    [
                      'S-Light',
                      [
                        '~#penpot/token-set',
                        [
                          '^ ',
                          '~:name',
                          'Tier 2 - Semantic/Light',
                          '~:tokens',
                          [
                            '~#ordered-map',
                            [
                              [
                                'background.surface',
                                ['^ ', '~:type', '~:color', '~:value', '{teal.600}'],
                              ],
                            ],
                          ],
                        ],
                      ],
                    ],
                  ],
                ],
              ],
            ],
          ],
          '~:themes',
          [
            '~#ordered-map',
            [
              [
                '',
                [
                  '~#ordered-map',
                  [
                    [
                      'Light',
                      [
                        '~#penpot/token-theme',
                        [
                          '^ ',
                          '~:name',
                          'Light',
                          '~:sets',
                          [
                            '^ ',
                            'Tier 1 - Primitive/Colors',
                            'Tier 1 - Primitive/Colors',
                            'Tier 2 - Semantic/Light',
                            'Tier 2 - Semantic/Light',
                          ],
                        ],
                      ],
                    ],
                  ],
                ],
              ],
            ],
          ],
          '~:active-themes',
          ['^ ', '/Light', '/Light'],
        ],
      ]),
    );

    expect(extractTokenSetsFromTokensLib(tokensLib)).toEqual([
      {
        id: 'theme:/Light',
        name: 'Light',
        css:
          ':root {\n' +
          '    --background-surface: var(--teal-600);\n' +
          '    --teal-600: #008080;\n' +
          '  }',
        active: true,
        kind: 'theme',
        tokenCount: 2,
      },
    ]);
  });
});
