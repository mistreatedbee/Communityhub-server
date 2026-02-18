import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { MONGODB_URI, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_FULL_NAME } = process.env;

if (!MONGODB_URI || !SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
  console.error('Missing env vars: MONGODB_URI, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD');
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    email: String,
    passwordHash: String,
    fullName: String,
    phone: String,
    avatarUrl: String,
    globalRole: String
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  const email = SUPER_ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email });
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  if (existing) {
    existing.globalRole = 'SUPER_ADMIN';
    existing.passwordHash = passwordHash;
    existing.fullName = SUPER_ADMIN_FULL_NAME || existing.fullName || '';
    await existing.save();
    console.log(`Promoted existing user to SUPER_ADMIN: ${email}`);
  } else {
    await User.create({
      email,
      passwordHash,
      fullName: SUPER_ADMIN_FULL_NAME || '',
      phone: '',
      avatarUrl: '',
      globalRole: 'SUPER_ADMIN'
    });
    console.log(`Created SUPER_ADMIN user: ${email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

