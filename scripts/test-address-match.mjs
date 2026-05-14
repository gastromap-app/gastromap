const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const cases = [
    ['Krolewska 57, 30-081 Krakow', 'Królewska 57, 30-081 Kraków, Poland', true],
    ['Plac Matejki 2, 31-157 Krakow', 'plac Jana Matejki 2, 31-157 Kraków, Poland', true],
    ['Rynek Główny 1-3, Sukiennice, Kraków', 'Sukiennice strona wschodnia, Rynek Główny 1, 31-042 Kraków, Poland', true],
    ['Starowiślna 12, 31-038 Kraków', 'Mogilska 65, 31-545 Kraków, Poland', false],
    ['Estery 13, 31-056 Kraków', 'plac Mariacki 3, 31-042 Kraków, Poland', false],
    ['Mikołajska 8, 31-027 Kraków', 'Mogilska 120c, 31-445 Kraków, Poland', false],
]

let pass = 0, fail = 0

cases.forEach(([db, google, expected]) => {
    const dbFull = norm(db)
    const googleFull = norm(google)
    const dbStreet = norm(db.split(',')[0])
    const googleStreet = norm(google.split(',')[0])
    const dbNum = db.match(/\d+/)?.[0] || ''
    const googleNum = google.match(/\d+/)?.[0] || ''
    const dbPostal = db.match(/\d{2}-\d{3}/)?.[0] || ''
    const googlePostal = google.match(/\d{2}-\d{3}/)?.[0] || ''

    const streetOverlap = dbStreet.includes(googleStreet.slice(0, Math.min(5, googleStreet.length))) || googleStreet.includes(dbStreet.slice(0, Math.min(5, dbStreet.length)))
    const numAndPartial = dbNum && dbNum === googleNum && (dbStreet.includes(googleStreet.slice(0, 4)) || googleStreet.includes(dbStreet.slice(0, 4)))
    const postalMatch = dbPostal && googlePostal && dbPostal === googlePostal
    const crossContains = googleFull.includes(dbStreet.slice(0, 6)) || dbFull.includes(googleStreet.slice(0, 6))

    const isMatch = streetOverlap || numAndPartial || postalMatch || crossContains
    const correct = isMatch === expected
    if (correct) pass++; else fail++
    console.log(correct ? '✅' : '❌', isMatch ? 'MATCH' : 'MISMATCH', '|', db.split(',')[0], 'vs', google.split(',')[0])
    if (!correct) console.log('   Expected:', expected, '| Got:', isMatch)
    if (!correct) console.log('   dbStreet:', dbStreet, '| googleStreet:', googleStreet, '| postal:', dbPostal, googlePostal)
})

console.log('\nResults:', pass, 'pass,', fail, 'fail')
