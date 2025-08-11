import { QuickDB } from "quick.db"

export const adminAuth = new QuickDB({
    filePath: "./db/admindb/admindb.sqlite"
})
