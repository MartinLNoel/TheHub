# TheHub recipe links

For any Claude instance asked to "turn this recipe into a TheHub recipe link". Martin plans recipes with Claude
and never types them into the app: you give him **one link**; he taps it (or pastes it into Fridge → Recipes),
sees a preview and saves it with one tap.

## What to give Martin

1. The recipe as normal text, so he can read it in the chat.
2. **The link**, on its own line, made exactly as below.
3. One line saying the nutrition per serving is an estimate, if you estimated it.

Do not ask him to type or edit anything in the app.

## The link

```
https://martinlnoel.github.io/TheHub/#/fridge/recipe-import/<payload>
```

`<payload>` is the recipe as JSON (below), encoded as UTF-8 and then as **base64url without padding** (`+` → `-`,
`/` → `_`, no trailing `=`). Do it with code, not by hand: a single wrong character breaks the link. In Python:

```python
import base64, json
recipe = {...}  # the JSON below
payload = base64.urlsafe_b64encode(json.dumps(recipe, ensure_ascii=False).encode("utf-8")).decode("ascii").rstrip("=")
print("https://martinlnoel.github.io/TheHub/#/fridge/recipe-import/" + payload)
```

If you cannot run code, give him the JSON in a code block instead: he can paste the JSON itself into Fridge →
Recipes and the app reads it the same way.

## The JSON

```json
{
  "thehub": "recipe",
  "v": 1,
  "name": "Chicken rice bowl",
  "servings": 2,
  "ingredients": ["300 g chicken breast", "150 g rice (dry)", "1 red pepper", "1 tbsp olive oil"],
  "steps": ["Cook the rice.", "Fry the chicken and pepper in the oil, 8 minutes.", "Serve on the rice."],
  "perServing": { "kcal": 560, "protein": 45, "carbs": 62, "fat": 12 },
  "notes": "Keeps 3 days in the fridge."
}
```

| Field | Rule |
|---|---|
| `thehub`, `v` | Always `"recipe"` and `1`. |
| `name` | Required, at most 120 characters. A recipe with the same name (any case) **replaces** the old one, so reuse the name to update a recipe. |
| `servings` | A whole number from 1 to 50 (default 1). |
| `ingredients` | Required: a list of lines, each with its amount ("200 g …"), at most 60 lines. |
| `steps` | A list of lines, at most 40 (may be empty). |
| `perServing` | Required: `kcal` and `protein` (numbers of 0 or more, per ONE serving); `carbs` and `fat` when you can. Use the amounts in the ingredients and common food tables; round to whole numbers. |
| `notes` | Optional text, at most 2000 characters. |

Lines are at most 400 characters. Anything else in the JSON is ignored.

## Why it is built this way

The app has no server: the recipe travels inside the link and is saved on Martin's phone (and in his verified
backups). Logging a serving adds its `perServing` numbers to his food log, so honest nutrition matters more than
precision to the gram.
