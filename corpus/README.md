# Gold error corpus

Sentences annotated with the mistakes they contain, to measure each rule's precision and recall. One JSON object per line in `corpus/<lang>/*.jsonl`:

```json
{"text": "Min tu dîtim.", "findings": [{"rule": "kmr.ergative.agreement", "span": "dîtim", "fix": "dîtî"}], "source": "zimankit lesson 23"}
{"text": "Min tu dîtî.", "findings": [], "source": "zimankit lesson 14"}
```

| field | meaning |
| --- | --- |
| `text` | one sentence |
| `findings` | every mistake in it: the rule, the text it covers, and the fix. Empty for a correct sentence |
| `source` | where it comes from |
| `review` | `draft` until a Kurdish speaker has checked it |

`make corpus` (after `make data`) prints precision and recall per rule and per family against the targets: orthography precision 0.98, spelling 0.90, morphology 0.90, agreement 0.90 with recall 0.60.

## Status

This is corpus v0: drafted from zimankit's lessons and rule examples, not from real errors in public texts. Its numbers are provisional, because a draft written by whoever wrote the rules shares their blind spots. Version 1.0 needs at least 600 sentences per variety, 300 with real errors, written or reviewed by native speakers.
