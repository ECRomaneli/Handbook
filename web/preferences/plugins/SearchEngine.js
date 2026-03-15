app.use({
  install: (app) => {
    const SearchEngine = require("@ecromaneli/search-engine")
    app.provide('$searchEngine', SearchEngine)
  }
})
