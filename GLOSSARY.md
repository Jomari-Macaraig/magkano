# Magkano

Helps Filipino households build a grocery list with price estimates, starting from a recipe or from what they already have at home, priced against DA and DTI publications.

## Recipes and lists

**Recipe**:
A named dish with a stated number of servings and a list of Ingredients; either a Seeded Recipe or one a user creates.
_Avoid_: Dish, meal

**Seeded Recipe**:
One of the curated Filipino Recipes shipped with the app.
_Avoid_: Default recipe, built-in recipe

**Ingredient**:
One line of a Recipe, naming a food item and its quantity ("2 cloves garlic"); it may have no quantity ("salt, to taste") and may be marked optional.
_Avoid_: Item, product

**Recipe Copy**:
A user's own Recipe made by copying a Seeded Recipe; independent of the original from the moment it is made.
_Avoid_: Fork, variant

**Grocery List**:
The set of things a user needs to buy, built from one or more Recipes, each at a chosen number of servings, with a price estimate per line and a total. Its prices are worked out afresh from the latest Price Observations whenever it is viewed; a saved one keeps only its Recipes, servings and the user's choices on each line.
_Avoid_: Shopping list, cart, basket

**Draft**:
A Grocery List that has not been saved to an account; it lives only on the user's device and survives a page refresh.
_Avoid_: Grocery draft, cart, temporary list

**Have It**:
A user's mark on a Grocery List line saying they already have that Ingredient at home, which removes it from the estimate.
_Avoid_: Pantry item, owned

## Prices

**Commodity**:
A priced item as named in a DA or DTI publication ("Garlic, imported, per kg").
_Avoid_: Product, price item

**Price Source**:
The publisher a price comes from: DA (Bantay Presyo market prices) or DTI (suggested retail prices).
_Avoid_: Provider, feed

**Publication**:
One dated issue of a Price Source's price list (a DA Daily Price Index, a DTI SRP bulletin); every Price Observation comes from one.
_Avoid_: Report, bulletin, file

**Price Observation**:
One Commodity's price in one Publication, for a stated amount.
_Avoid_: Price, price point, quote

**Purchase Unit**:
The smallest amount of a Commodity a shopper would actually buy (¼ kg, one can); a Grocery List line's needed quantity is rounded up to it.
_Avoid_: Pack size, minimum order

**Tag**:
A food from one shared vocabulary ("onion", "red-onion"), with English and Tagalog aliases ("liempo", "sibuyas"). A Tag may have one parent that is a more general form of the same food. Each Ingredient and each Commodity carries exactly one Tag, the most specific that fits, and through it all of that Tag's ancestors. Origin, brand, grade, size and price-list category are never Tags.
_Avoid_: Label, category, keyword

**Tag Assignment**:
The Tag given to one Ingredient or one Commodity. An LLM proposes it; it counts only once a person has reviewed it, and a reviewed Tag Assignment is reused rather than proposed again.
_Avoid_: Tagging, label, classification

**Unit Conversion**:
How much one unit of a food weighs or holds ("garlic: 1 clove = 5 g", "rice: 1 cup = 185 g"), kept on a Tag and inherited by its more specific Tags; a Commodity's own stated weight per piece takes precedence.
_Avoid_: Density, unit mapping

**Ingredient Match**:
A Commodity whose Tag lies on the same ancestor chain as an Ingredient's Tag (one is the other or an ancestor of it), taken at the most specific Tag they share; sibling Tags never match. One Ingredient may have several.
_Avoid_: Mapping, join, link

**Rough Estimate**:
A line price that assumes one Purchase Unit because the needed amount can't be converted into the Commodity's units; always labelled as an estimate.
_Avoid_: Approximation, guess

**Price Override**:
A price a user enters for the whole of one line of one Grocery List, replacing the price worked out from its Ingredient Matches.
_Avoid_: Custom price, manual price
