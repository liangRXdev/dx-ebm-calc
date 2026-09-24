# Diagnostic Test EBM Calculator (診斷檢驗 EBM 計算器)

**English** | [繁體中文](README.zh-TW.md)

> Diagnostic Test EBM Calculator — by pharmacist Che-chia Liang (梁哲嘉)

An interactive evidence-based calculator for diagnostic tests: computes likelihood ratios (LR) from a 2×2 table or sensitivity/specificity, updates pre-test → post-test probability with the odds form of Bayes' theorem, and visualizes it on an interactive Fagan nomogram. Built for both teaching and EBM journal clubs; the interface is in Traditional Chinese.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Click%20Here-blue?style=for-the-badge)](https://liangrxdev.github.io/dx-ebm-calc/)

## Features

- **Test metrics**: from 2×2 counts or directly entered sens/spec → sensitivity, specificity, PPV, NPV, accuracy, LR+, LR− (95% CIs in 2×2 mode)
- **Plain-language LR grading**: automatically labels "strong / moderate / weak rule-in / rule-out" by LR magnitude (Jaeschke/McGee criteria)
- **Bayesian update**: pre-test → post-test probability, showing the odds chain step by step
- **Interactive Fagan nomogram**: drag the left axis for live updates; pre- and post-test probabilities are marked on the chart
- **Quick-reference LR library for common tests** (`tests.json`): 16 entries with original citations, loadable by "diagnostic / prognostic"
- **Plain-language summary**: one-click copy (for notes / teaching), clear all

## Tech

- Single-file `index.html` (vanilla JS + SVG, no framework, no dependencies)
- Data: `tests.json` (test library; single source of truth, extensible)
- Style: MUJI-like palette consistent with the personal clinical tool collection (pharmacy-portal)

## Methodology References

- Likelihood ratios and diagnostic tests: Deeks JJ, Altman DG. *BMJ* 2004;329:168-9
- LR strength grading: Jaeschke/Guyatt/Sackett *JAMA* 1994; McGee *J Gen Intern Med* 2002
- Fagan nomogram: Fagan TJ. *NEJM* 1975;293:257
- Sources for each test's sens/spec are in the `source` field of each `tests.json` entry

## Formulas

- LR+ = sens/(1−spec); LR− = (1−sens)/spec
- post-test odds = pre-test odds × LR; odds = p/(1−p)
- 95% CI: log method for LR (Simel 1991), Wilson score for proportions; zero cells get a 0.5 continuity correction

## Disclaimer

This tool is **for teaching and EBM practice only, not a basis for clinical decisions**. Test LRs vary with the study population and cutoff; check the original papers before clinical use.

## License

MIT
