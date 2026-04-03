<template>
  <div class="form">
    <div
      v-if="registering"
      class="form-group"
    >
      <label
        v-once
        for="usernameInput"
      >{{ $t('username') }}</label>
      <input
        id="usernameInput"
        v-model="username"
        class="form-control"
        type="text"
        :placeholder="$t('usernamePlaceholder')"
        :class="{'input-valid': usernameValid, 'input-invalid': usernameInvalid}"
      >
      <div
        v-for="issue in usernameIssues"
        :key="issue"
        class="input-error"
      >
        {{ issue }}
      </div>
    </div>
    <div
      v-if="!registering"
      class="form-group"
    >
      <label
        v-once
        for="usernameInput"
      >{{ $t('emailOrUsername') }}</label>
      <input
        id="usernameInput"
        v-model="username"
        class="form-control"
        type="text"
        :placeholder="$t('emailOrUsername')"
      >
    </div>
    <div
      v-if="registering"
      class="form-group"
    >
      <label
        v-once
        for="emailInput"
      >{{ $t('email') }}</label>
      <input
        id="emailInput"
        v-model="email"
        class="form-control"
        type="email"
        :placeholder="$t('emailPlaceholder')"
        :class="{'input-invalid': emailInvalid, 'input-valid': emailValid}"
      >
    </div>
    <div class="form-group">
      <label
        v-once
        for="passwordInput"
      >{{ $t('password') }}</label>
      <a
        v-if="!registering"
        v-once
        class="float-right forgot-password"
        @click="forgotPassword = true"
      >{{ $t('forgotPassword') }}</a>
      <input
        id="passwordInput"
        v-model="password"
        class="form-control"
        type="password"
        :placeholder="$t(registering ? 'passwordPlaceholder' : 'password')"
        :class="{
          'input-valid': registering ? passwordValid : false,
          'input-invalid': registering ? passwordInvalid: false,
        }"
      >
      <div
        v-if="passwordInvalid && registering"
        class="input-error"
      >
        {{ $t('minPasswordLength') }}
      </div>
    </div>
    <div
      v-if="registering"
      class="form-group"
    >
      <label
        v-once
        for="confirmPasswordInput"
      >{{ $t('confirmPassword') }}</label>
      <input
        id="confirmPasswordInput"
        v-model="passwordConfirm"
        class="form-control"
        type="password"
        :placeholder="$t('confirmPasswordPlaceholder')"
        :class="{'input-invalid': passwordConfirmInvalid, 'input-valid': passwordConfirmValid}"
      >
      <div
        v-if="passwordConfirmInvalid"
        class="input-error"
      >
        {{ $t('passwordConfirmationMatch') }}
      </div>
    </div>
    <div class="text-center">
      <div
        v-if="registering"
        v-once
        class="btn btn-info"
        @click="register()"
      >
        {{ $t('joinHabitica') }}
      </div>
      <div
        v-if="!registering"
        v-once
        class="btn btn-info"
        @click="login()"
      >
        {{ $t('login') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import '@/assets/scss/colors.scss';

  .form {
    margin: 0 auto;
    width: 100%;
    padding-top: 2em;
    padding-bottom: 4em;
    position: relative;
    z-index: 1;

    .form-group {
      text-align: left;
      font-weight: bold;
    }

    small.form-text {
      text-align: center;
    }

    .input-error {
      margin-top: 0.25em;
      font-weight: normal;
      font-size: 90%;
      width: 100%;
    }
  }
</style>

<script>
import debounce from 'lodash/debounce';
import isEmail from 'validator/es/lib/isEmail';
import { MINIMUM_PASSWORD_LENGTH } from '@/../../common/script/constants';
import { setUpAxios } from '@/libs/auth';

export default {
  name: 'AuthForm',
  data () {
    const data = {
      registering: true,
      username: '',
      email: '',
      password: '',
      passwordConfirm: '',
      usernameIssues: [],
    };

    return data;
  },
  computed: {
    emailValid () {
      if (this.email.length <= 3) return false;
      return isEmail(this.email);
    },
    emailInvalid () {
      if (this.email.length <= 3) return false;
      return !this.emailValid;
    },
    usernameValid () {
      if (this.username.length < 1) return false;
      return this.usernameIssues.length === 0;
    },
    usernameInvalid () {
      if (this.username.length < 1) return false;
      return !this.usernameValid;
    },
    passwordValid () {
      if (this.password.length <= 0) return false;
      return this.password.length >= MINIMUM_PASSWORD_LENGTH;
    },
    passwordInvalid () {
      if (this.password.length <= 0) return false;
      return this.password.length < MINIMUM_PASSWORD_LENGTH;
    },
    passwordConfirmValid () {
      if (this.passwordConfirm.length <= 3) return false;
      return this.passwordConfirm === this.password;
    },
    passwordConfirmInvalid () {
      if (this.passwordConfirm.length <= 3) return false;
      return !this.passwordConfirmValid;
    },
  },
  watch: {
    username () {
      this.validateUsername(this.username);
    },
  },
  methods: {
    // eslint-disable-next-line func-names
    validateUsername: debounce(function (username) {
      if (username.length < 1) {
        return;
      }
      this.$store.dispatch('auth:verifyUsername', {
        username: this.username,
      }).then(res => {
        if (res.issues !== undefined) {
          this.usernameIssues = res.issues;
        } else {
          this.usernameIssues = [];
        }
      });
    }, 500),
    async register () {
      if (!this.email) {
        window.alert(this.$t('missingEmail')); // eslint-disable-line no-alert
        return;
      }

      if (this.password !== this.passwordConfirm) {
        window.alert(this.$t('passwordConfirmationMatch')); // eslint-disable-line no-alert
        return;
      }

      try {
        await this.$store.dispatch('auth:register', {
          username: this.username,
          email: this.email,
          password: this.password,
          passwordConfirm: this.passwordConfirm,
        });

        await this.finishAuth();
      } catch (e) {
        if (e.response.data.data && e.response.data.data.errors) {
          const message = e.response.data.data.errors.map(error => `${error.message}\n`);
          window.alert(message); // eslint-disable-line no-alert
        }
      }
    },
    async finishAuth () {
      setUpAxios();

      await this.$store.dispatch('user:fetch', { forceLoad: true });

      this.$emit('authenticate');
    },
  },
};
</script>
