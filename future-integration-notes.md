# Future Integration Notes

## Additional Metrics To Add Later

Yes. There are a few metrics that would make this much more informative.

The most useful additions are:

- **active vs inactive mass**
- **electrolyte fraction**
- **packaging overhead**
- **areal loading / areal energy**
- **capacity-limiting electrode and N/P ratio**
- **module overhead beyond cell sum**
- **cost split into electrochemistry vs structure**

With your current data, you can already compute several of them.

## 1. Active vs inactive mass

You need to define this clearly, because there are two valid ways.

### A. Strictly active solids

Count only the materials that directly store charge:

- Zn anode = **0.071 kg**
- Cathode composite = **0.026 kg**

So:

- **active solids mass = 0.097 kg**
- **inactive/other mass = 0.203 - 0.097 = 0.106 kg**

Fractions:

- **active solids fraction = 47.8%**
- **non-active fraction = 52.2%**

This is a useful number because it tells the user how much of the cell mass is actually charge-storing solid.

### B. Electrochemically functional vs structural

Count the GPE as functional, even if it is not an active material in the strict sense.

Functional electrochemistry:

- Zn anode = **0.071 kg**
- Cathode = **0.026 kg**
- GPE = **0.053 kg**

So:

- **functional mass = 0.150 kg**
- **structural/inactive mass = casing + current collector = 0.040 + 0.013 = 0.053 kg**

Fractions:

- **functional fraction = 73.9%**
- **structural fraction = 26.1%**

This is often the more useful engineering split.

## 2. Packaging overhead

At the **cell level**, packaging-like mass is:

- casing + current collector = **0.053 kg**

So:

- **packaging overhead = 26.1 wt%**

You can also express this as a ratio:

- **packaging / active solids = 0.053 / 0.097 = 0.55**
- so about **0.55 kg of structural hardware per kg of active solids**

That is a good compact KPI.

## 3. Electrolyte fraction

Your GPE is large enough that it deserves its own KPI.

- GPE mass = **0.053 kg**
- total cell mass = **0.203 kg**

So:

- **electrolyte fraction = 26.1 wt%**

This is worth showing because in your design the electrolyte is not a small detail. It is one of the dominant contributors to both mass and cost.

## 4. Cost split: electrochemistry vs structure

From your table:

- casing = **EUR 0.20**
- current collector = **EUR 0.10**
- structure subtotal = **EUR 0.30**

Electrochemistry-related:

- GPE = **EUR 0.90**
- Zn anode = **EUR 1.06**
- cathode = **EUR 0.26**
- subtotal = **EUR 2.22**

Fractions:

- **electrochemistry cost share = 87.7%**
- **structure cost share = 11.9%**

That is useful because it shows your cost is dominated by the chemistry, especially Zn + GPE.

## 5. Areal metrics

These are very useful for electrochemical people.

You already have:

- active area = **200 cm2**
- capacity = **11.7 Ah**
- energy = **14.04 Wh**
- current = **1.0 A**

So:

- **areal capacity = 11.7 Ah / 200 cm2 = 58.5 mAh/cm2**
- **areal energy = 14.04 Wh / 200 cm2 = 70.2 mWh/cm2**
- **areal power = 1.20 W / 200 cm2 = 6.0 mW/cm2**
- **Zn loading = 71 g / 200 cm2 = 355 mg/cm2**

These are strong descriptors and often more meaningful than just cell totals.

## 6. Capacity per zinc mass

This is also useful because it shows how conservative the 20% DoD assumption is.

- Zn mass = **71 g**
- usable capacity = **11.7 Ah**

So:

- **usable specific capacity referred to Zn actually used in the design = 11.7 Ah / 71 g = 165 mAh/g-Zn**

That is exactly **20% of theoretical Zn capacity**, which is a nice sanity check.

## 7. Module overhead beyond summed cells

From your earlier module view:

- 100 cells x 0.203 kg = **20.3 kg**
- module mass = **23.345 kg**

So module extra hardware is:

- **3.045 kg**

That means:

- **module overhead beyond cells = 13.0 wt% of module mass**
- or **15.0% relative to summed cell mass**

This is a very good number to show, because it separates:

- cell-level hardware penalty
- module-level hardware penalty

## 8. Module active/inactive split

Using the same definition as above:

### Per 100 cells

- active solids = **9.7 kg**
- functional electrochemistry = **15.0 kg**
- cell-integrated structure = **5.3 kg**
- module extra hardware = **3.045 kg**

So at module level:

### Strict active solids basis

- **active solids = 9.7 kg**
- **everything else = 23.345 - 9.7 = 13.645 kg**
- **active solids fraction = 41.6%**

### Functional vs total structure basis

- functional electrochemistry = **15.0 kg**
- total structure = **5.3 + 3.045 = 8.345 kg**
- **functional fraction = 64.3%**
- **total structure fraction = 35.7%**

That is a useful module-level counterpart to the cell-level split.

## 9. What is probably missing and would be very useful

The single most important missing item is:

### N/P ratio or electrode capacity balance

Right now you show the Zn-based capacity, but not whether the cathode can actually support it.

You should ideally show:

- theoretical cathode capacity
- practical cathode capacity
- anode capacity
- **N/P ratio**

Without that, the user cannot tell whether:

- the cell is Zn-limited,
- cathode-limited,
- or deliberately overbuilt on one side.

For a real design, this is one of the most important omitted metrics.

## 10. Other useful metrics you may want

These are worth adding if you have the inputs:

- **Zn utilization (%)**
- **cathode utilization (%)**
- **coulombic efficiency assumption**
- **nominal round-trip efficiency**
- **projected cycle life at the selected DoD**
- **stack pressure / compression requirement**
- **internal resistance or ASR**
- **voltage efficiency at the chosen current density**
- **energy based on nominal discharge voltage vs OCV**
- **Wh per EUR**
- **Ah per EUR**

For example, from your current data:

- **Wh/EUR = 14.04 / 2.53 = 5.55 Wh/EUR**
- **EUR/Wh = 2.53 / 14.04 = 0.180 EUR/Wh**
- **EUR/kWh = 180 EUR/kWh**

That is a simple and useful commercial metric.

## What I would add directly to your interface

I would add these first:

- **Active solids fraction:** 47.8 wt%
- **Functional electrochemistry fraction:** 73.9 wt%
- **Structural fraction:** 26.1 wt%
- **Electrolyte fraction:** 26.1 wt%
- **Areal capacity:** 58.5 mAh/cm2
- **Areal energy:** 70.2 mWh/cm2
- **Zn loading:** 355 mg/cm2
- **Module overhead beyond cells:** 13.0 wt%
- **N/P ratio:** if you can calculate it

If you want a single compact block, I would format it as:

### Cell composition KPIs

- Active solids fraction: **47.8 wt%**
- Functional electrochemistry fraction: **73.9 wt%**
- Structural fraction: **26.1 wt%**
- Electrolyte fraction: **26.1 wt%**
- Areal capacity: **58.5 mAh/cm2**
- Areal energy: **70.2 mWh/cm2**
- Zn loading: **355 mg/cm2**

### Module integration KPIs

- Cell-only mass: **20.3 kg**
- Module mass: **23.345 kg**
- Module overhead beyond cells: **3.045 kg**
- Module overhead fraction: **13.0 wt%**

The one thing I would not hide is that the cathode entry is still lumped. If you split it into:

- MnO2
- carbon
- Ni mesh
- binder

then the active/inactive breakdown becomes much more informative.
