const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

// Leer variables de entorno desde .env.local
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    envVars[key.trim()] = value.trim().replace(/['"]/g, '')
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Variables de entorno no encontradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function findUser() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, member_number, email')
    .ilike('name', '%lucia guerrero%')
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  if (!data || data.length === 0) {
    console.log('No se encontró ningún usuario con ese nombre')
    return
  }
  
  console.log('Usuarios encontrados:')
  data.forEach(u => {
    console.log(`- ID: ${u.id}`)
    console.log(`  Nombre: ${u.name}`)
    console.log(`  N° Socio: ${u.member_number}`)
    console.log(`  Email: ${u.email || 'N/A'}`)
    console.log('---')
  })
}

findUser()
