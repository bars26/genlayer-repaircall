# Test fixtures

Trimmed copies of real iFixit API 2.0 responses (`https://www.ifixit.com/api/2.0/...`), fetched 2026-11-11, used by the
direct-mode tests with mocked web reads:

- `guide-248913.json`: "Xbox Series LB RB repair" by @HectorNavarroMX (16 steps, every step photographed).
- `guide-187435.json`, `guide-179646.json`, `guide-179645.json`, `guide-171489.json`, `guide-160588.json`: earlier guides
  of the same device, read by the copy check.
- `category-xbox-series-x-controller.json`: the device page (its ancestors up to "Game Console", and its guides).
- `user-2567058.json`: the author's public profile.

Only the fields the contract reads are kept. The guides are iFixit community content under CC BY-NC-SA 3.0 by their
authors, included here for testing only.
