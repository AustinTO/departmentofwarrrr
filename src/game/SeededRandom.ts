/** Small deterministic PRNG for reproducible campaign choices. */
export function createSeededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function randomIndex(random: () => number, length: number): number {
    return length > 0 ? Math.floor(random() * length) : -1;
}

export function seededShuffle<T>(items: T[], random: () => number): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = randomIndex(random, i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
