const bcrypt = require("bcryptjs");

async function main() {
  const password = process.argv.slice(2).join(" ");
  if (!password) {
    console.error('Использование: npm run hash-password -- "ВашПароль"');
    process.exit(1);
  }
  console.log(await bcrypt.hash(password, 12));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
