# Playwright Smart Table

Dealing with tables sucks. The locators involved are often ugly, brittle, and difficult to wrap your head around.

Column moved? Your `nth-child` is wrong. Grid rerenders? Your locator is stale. Table paginates? Now you're writing a loop. Virtualized? Half the rows aren't even in the DOM.

And that's before you factor in that every table is different — semantic `<table>` elements are the exception, not the rule. You're more likely to be dealing with a full `<div>`-based grid where the library author made all their own decisions about structure, attributes, and behavior.

Playwright Smart Table doesn't try to solve all of that for you automatically. Instead it gives you a way to describe how your specific table works — where the headers are, how pagination works, what's virtualized — and then lets you ask questions against it in plain terms: give me the row where Name is John Doe, go through every row and give me the ones where Salary is over 50,000, find all rows with Status active across the first five pages.

You describe your table. Playwright Smart Table does the rest.

[Get started](/guide/start) · [See examples](/examples/)

---

_Outline — content TBD_
