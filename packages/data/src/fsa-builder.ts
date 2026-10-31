import { encodeArc, Fsa, MAX_ALPHABET, MAX_ARCS } from "./fsa.js";

interface BuildNode {
  labels: number[];
  finals: boolean[];
  targets: BuildNode[];
  id: number;
}

const newNode = (): BuildNode => ({ labels: [], finals: [], targets: [], id: -1 });

/**
 * Build the minimal automaton of a sorted word list (Daciuk's incremental algorithm): each
 * finished suffix is merged with an identical one that already exists, so the memory used
 * stays close to the size of the result. Words must be unique and in code unit order.
 */
export function buildFsa(words: readonly string[]): Fsa {
  const units = new Set<number>();
  for (const word of words) {
    if (word === "") throw new Error("the empty word cannot be stored");
    for (let i = 0; i < word.length; i++) units.add(word.charCodeAt(i));
  }
  if (units.size > MAX_ALPHABET) throw new Error(`alphabet of ${units.size} exceeds ${MAX_ALPHABET}`);
  const alphabet = Uint16Array.from([...units].sort((a, b) => a - b));
  const labelOf = new Map<number, number>();
  alphabet.forEach((unit, label) => {
    labelOf.set(unit, label);
  });

  const register = new Map<string, BuildNode>();
  let nextId = 0;
  const intern = (node: BuildNode): BuildNode => {
    const key = node.labels
      .map((label, i) => `${label}${node.finals[i] ? "!" : ":"}${(node.targets[i] as BuildNode).id}`)
      .join(",");
    const existing = register.get(key);
    if (existing) return existing;
    node.id = nextId++;
    register.set(key, node);
    return node;
  };
  const stack: BuildNode[] = [newNode()];
  const minimizeTo = (depth: number): void => {
    for (let d = stack.length - 2; d >= depth; d--) {
      const parent = stack[d] as BuildNode;
      parent.targets[parent.targets.length - 1] = intern(stack[d + 1] as BuildNode);
    }
    stack.length = depth + 1;
  };

  let previous = "";
  for (const word of words) {
    if (previous !== "" && word <= previous) {
      throw new Error(
        `words must be sorted and unique: ${JSON.stringify(previous)} then ${JSON.stringify(word)}`,
      );
    }
    let common = 0;
    const limit = Math.min(word.length, previous.length);
    while (common < limit && word.charCodeAt(common) === previous.charCodeAt(common)) common++;
    minimizeTo(common);
    for (let i = common; i < word.length; i++) {
      const node = stack[i] as BuildNode;
      const child = newNode();
      node.labels.push(labelOf.get(word.charCodeAt(i)) as number);
      node.finals.push(false);
      node.targets.push(child);
      stack.push(child);
    }
    const owner = stack[word.length - 1] as BuildNode;
    owner.finals[owner.finals.length - 1] = true;
    previous = word;
  }
  minimizeTo(0);

  // Children first, so that a parent's targets are always earlier addresses.
  const arcs: number[] = [0];
  const address = new Map<BuildNode, number>();
  const emit = (node: BuildNode): number => {
    if (node.labels.length === 0) return 0;
    const known = address.get(node);
    if (known !== undefined) return known;
    const targets = node.targets.map(emit);
    const start = arcs.length;
    node.labels.forEach((label, i) => {
      const last = i === node.labels.length - 1;
      arcs.push(encodeArc(label, last, node.finals[i] as boolean, targets[i] as number));
    });
    address.set(node, start);
    return start;
  };
  emit(stack[0] as BuildNode);
  if (arcs.length > MAX_ARCS) throw new Error(`${arcs.length} arcs exceed the format's limit`);
  return new Fsa(Uint32Array.from(arcs), alphabet);
}
