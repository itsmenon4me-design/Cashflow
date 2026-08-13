import { serializeBigInt } from './serializer';

describe('serializeBigInt', () => {
  test('converts top-level BigInt to string', () => {
    const input = 100000n;
    expect(serializeBigInt(input)).toBe('100000');
  });

  test('converts nested BigInt values', () => {
    const input = {
      a: 1,
      b: 2n,
      c: {
        d: 3n,
        e: 'foo',
      },
      arr: [1n, 'x', 3],
      n: null,
      bool: true,
    };
    const out = serializeBigInt(input);
    expect(out.a).toBe(1);
    expect(out.b).toBe('2');
    expect(out.c.d).toBe('3');
    expect(out.c.e).toBe('foo');
    expect(out.arr[0]).toBe('1');
    expect(out.arr[1]).toBe('x');
    expect(out.arr[2]).toBe(3);
    expect(out.n).toBeNull();
    expect(out.bool).toBe(true);
  });

  test('dates become ISO strings', () => {
    const d = new Date('2020-01-02T03:04:05Z');
    const out = serializeBigInt({ dt: d });
    expect(out.dt).toBe(d.toISOString());
  });
});
