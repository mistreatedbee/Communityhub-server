import 'dotenv/config';
import mongoose from 'mongoose';

const emailArg = process.argv[2];
if (!process.env.MONGODB_URI || !emailArg) {
  console.error('Usage: MONGODB_URI=<...> node scripts/promoteSuperAdmin.js user@example.com');
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    email: String,
    globalRole: String
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const email = emailArg.toLowerCase().trim();
  const user = await User.findOneAndUpdate({ email }, { globalRole: 'SUPER_ADMIN' }, { new: true });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }
  console.log(`Promoted ${email} to SUPER_ADMIN`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

