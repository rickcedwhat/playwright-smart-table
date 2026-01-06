# Roadmap

## Future (v4.0.0+)
- [ ] **Canvas/DataGrid Support**: Investigate supporting canvas-based grids (Glide, AG Grid, etc.) via a new "Strategy" implementation.
    - *Challenge*: Canvas elements are opaque to the accessibility tree (often 0x0 fallback elements).
    - *Approach*: Use the existing "Strategy" pattern (e.g., `InteractionStrategy` or `DriverStrategy`) to bridge Playwright interactions to the grid's internal JS API.
    - *Goal*: Allow users to define a strategy that queries the grid for cell coordinates/data rather than relying on the DOM.
    - *Status*: Experimental concept.
