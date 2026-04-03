import debounce from 'lodash/debounce';
import isEmail from 'validator/es/lib/isEmail';
import { MINIMUM_PASSWORD_LENGTH } from '@/../../common/script/constants';

export default {
  data () {
    return {
      email: '',
      emailError: null,
      emailValid: false,
      password: '',
      passwordConfirm: '',
      passwordValid: false,
      passwordInvalid: false,
      passwordConfirmValid: false,
      passwordConfirmInvalid: false,
      registrationMethod: null,
      username: '',
    };
  },
  watch: {
    email () {
      this.validateEmail(this.email);
    },
    password () {
      this.validatePassword(this.password);
    },
    passwordConfirm () {
      this.validatePasswordConfirm(this.passwordConfirm);
    },
  },
  methods: {
    validateEmail: debounce(function valEmail (email) {
      if (!email) {
        this.emailValid = false;
        this.emailError = null;
        return;
      }
      if (!isEmail(email)) {
        this.emailValid = false;
        this.emailError = this.$t('enterValidEmail');
        return;
      }
      this.$store.dispatch('auth:checkEmail', {
        email,
      }).then(res => {
        if (!res.valid) {
          this.emailValid = false;
          this.emailError = this.$t('cannotFulfillReq');
          return;
        }
        this.emailValid = true;
        this.emailError = null;
      });
    }, 500),
    validatePassword: debounce(function valPass (password) {
      if (!password) {
        this.passwordValid = false;
        this.passwordInvalid = false;
        return;
      }
      this.passwordValid = password.length >= MINIMUM_PASSWORD_LENGTH;
      this.passwordInvalid = password.length < MINIMUM_PASSWORD_LENGTH;
    }, 500),
    validatePasswordConfirm: debounce(function valPassConf (passwordConfirm) {
      if (!passwordConfirm) {
        this.passwordConfirmValid = false;
        this.passwordConfirmInvalid = false;
        return;
      }
      this.passwordConfirmValid = passwordConfirm === this.password;
      this.passwordConfirmInvalid = passwordConfirm !== this.password;
    }, 500),
    async proceed (accountType) {
      if (accountType === 'local') {
        this.$store.state.registrationOptions = {
          email: this.email,
          password: this.password,
          passwordConfirm: this.passwordConfirm,
          registrationMethod: 'local',
        };
      }
      this.$router.push({ name: 'username', query: this.$route.query });
    },
  },
};
